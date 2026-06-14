import type { WASocket, BaileysEventMap } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
} from "../db.js";
import { generateReply } from "../ai.js";
import pino from "pino";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

// Debounce: espera N segundos desde el último mensaje antes de responder
const DEBOUNCE_MS = parseInt(process.env.REPLY_DEBOUNCE_MS ?? "25000", 10);
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Delay aleatorio para simular tipeo humano
function humanDelay(): Promise<void> {
  const min = parseInt(process.env.REPLY_DELAY_MIN ?? "1000", 10);
  const max = parseInt(process.env.REPLY_DELAY_MAX ?? "3500", 10);
  const ms = min + Math.random() * (max - min);
  return new Promise((r) => setTimeout(r, ms));
}

// Silencio nocturno según hora de Chile (UTC-3/-4 DST)
function isQuietHour(): boolean {
  const start = parseInt(process.env.QUIET_HOUR_START ?? "22", 10);
  const end = parseInt(process.env.QUIET_HOUR_END ?? "8", 10);
  const hChile = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santiago",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10
  );
  return start > end
    ? hChile >= start || hChile < end   // cruza medianoche
    : hChile >= start && hChile < end;
}

export async function handleIncomingMessages(
  sock: WASocket,
  event: BaileysEventMap["messages.upsert"]
): Promise<void> {
  if (event.type !== "notify") return;

  for (const msg of event.messages) {
    if (msg.key.fromMe) continue;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) continue;

    if (
      remoteJid.endsWith("@g.us") ||
      remoteJid.endsWith("@broadcast") ||
      remoteJid.endsWith("@newsletter")
    ) continue;

    if (
      !remoteJid.endsWith("@s.whatsapp.net") &&
      !remoteJid.endsWith("@lid")
    ) continue;

    const text =
      msg.message?.conversation ??
      msg.message?.extendedTextMessage?.text ??
      null;
    if (!text) continue;

    const phone = remoteJid.split("@")[0].split(":")[0];
    const name = msg.pushName ?? undefined;

    const convo = getOrCreateConversation(phone, name, remoteJid);
    insertMessage(convo.id, "user", text);

    const fresh = getConversationById(convo.id);
    if (!fresh || fresh.mode !== "AI") {
      logger.debug({ phone, mode: fresh?.mode }, "Mensaje en modo HUMAN — omitido");
      continue;
    }

    // Silencio nocturno: guardar mensaje pero no responder
    if (isQuietHour()) {
      logger.info({ phone }, "Silencio nocturno — respuesta diferida");
      continue;
    }

    // Debounce: cancelar timer anterior y arrancar uno nuevo
    // Si el cliente manda otro mensaje antes de que expire, se reinicia
    const existingTimer = debounceTimers.get(phone);
    if (existingTimer) {
      clearTimeout(existingTimer);
      logger.debug({ phone, debounceMs: DEBOUNCE_MS }, "Debounce reiniciado");
    }

    const convId  = convo.id;
    const jid     = remoteJid;

    debounceTimers.set(
      phone,
      setTimeout(async () => {
        debounceTimers.delete(phone);

        await humanDelay();

        const fresh2 = getConversationById(convId);
        if (!fresh2 || fresh2.mode !== "AI") return;

        const history = getRecentHistory(convId, 20);

        try {
          const reply = await generateReply({ history, conversationId: convId, phone });
          if (!reply) return;
          insertMessage(convId, "assistant", reply);
          await sock.sendMessage(jid, { text: reply });
          logger.debug({ phone, replyLength: reply.length }, "Respuesta enviada");
        } catch (err) {
          logger.error({ phone, err }, "Error generando respuesta");
        }
      }, DEBOUNCE_MS)
    );
  }
}
