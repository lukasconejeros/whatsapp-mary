import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { Boom } from "@hapi/boom";
import { setConnectionState, getConnectionState } from "../db.js";
import { handleIncomingMessages } from "./handler.js";
import { startOutboxLoop, stopOutboxLoop } from "./outbox.js";

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const DATA_DIR = path.resolve(process.cwd(), "data");
const RESTART_FLAG = path.join(DATA_DIR, ".restart");

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

interface BotHandle {
  sock: WASocket;
  shutdown: () => void;
}

let handle: BotHandle | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export async function start(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  // Always fetch latest version — WhatsApp rejects stale versions with code 405
  let version: readonly [number, number, number] | undefined;
  try {
    const result = await fetchLatestBaileysVersion();
    version = result.version;
  } catch {
    logger.warn("No se pudo obtener la versión de Baileys; usando versión interna");
    version = undefined;
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }), // Baileys ALWAYS silent
    browser: Browsers.macOS("Desktop"), // Known fingerprint — custom triggers code 440 loop
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  // code 515 = pairing OK signal — not an error, ignore
  // code 405 = stale version (mitigated by fetchLatestBaileysVersion)
  // code 440 = connectionReplaced / browser fingerprint (mitigated by macOS Desktop + 15s backoff)

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
      (qrcodeTerminal as { generate: (qr: string, opts: { small: boolean }) => void }).generate(qr, { small: true });
      logger.info("QR generado — escanea desde otro móvil");
    }

    if (connection === "connecting") {
      const current = getConnectionState();
      if (current.status === "disconnected") {
        setConnectionState({ status: "connecting" });
      }
    }

    if (connection === "open") {
      const userId = sock.user?.id ?? "";
      const phone = userId.split(":")[0].split("@")[0];
      setConnectionState({ status: "connected", qr_string: null, phone });
      startOutboxLoop(sock);
      logger.info({ phone }, "WhatsApp conectado");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      stopOutboxLoop();

      if (code === DisconnectReason.loggedOut) {
        // code 401 — session invalidated, do NOT reconnect
        setConnectionState({ status: "disconnected", qr_string: null, phone: null });
        logger.warn("Sesión cerrada (logout). Reconecta escaneando el QR.");
      } else {
        // Caída no-logout: el socket está MUERTO. Antes se dejaba el estado "as-is", o sea
        // pegado en 'connected' → la app aceptaba envíos, los mostraba "enviado" y nunca
        // salían. Marcamos 'connecting' para que /api/send avise y no se pierda nada.
        setConnectionState({ status: "connecting", qr_string: null });
        scheduleReconnect(code);
      }
    }
  });

  sock.ev.on("messages.upsert", (event) => {
    handleIncomingMessages(sock, event).catch((err) => {
      logger.error({ err }, "Error procesando mensaje");
    });
  });

  handle = {
    sock,
    shutdown: () => {
      sock.end(undefined);
    },
  };
}

function scheduleReconnect(code: number | undefined): void {
  if (reconnectTimer) return; // already scheduled

  // code 440 = connectionReplaced: reconnecting too fast causes a loop; wait 15s
  const delay = code === 440 ? 15000 : 5000;

  logger.info({ code, delay }, "Reconectando en " + delay + "ms...");

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    handle?.sock.end(undefined); // clean up old socket listeners
    handle = null;
    try {
      await start();
    } catch (err) {
      // Sin este try/catch, un fallo de start() dejaba la promesa sin capturar
      // (unhandledRejection → cae el proceso) y NADIE reprogramaba: bot muerto para
      // siempre. Ahora se reintenta.
      logger.error({ err }, "Fallo al reconectar; reintentando");
      scheduleReconnect(code);
    }
  }, delay);
}

export function watchRestartFlag(): void {
  setInterval(() => {
    if (fs.existsSync(RESTART_FLAG)) {
      fs.unlinkSync(RESTART_FLAG);
      logger.info("Flag de restart detectado — regenerando QR...");
      stopOutboxLoop();
      handle?.sock.end(undefined);
      handle = null;
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      start().catch((err) => logger.error({ err }, "Error al reconectar"));
    }
  }, 1000);
}
