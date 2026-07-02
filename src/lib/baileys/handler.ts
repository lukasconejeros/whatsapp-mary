import type { WASocket, BaileysEventMap, proto } from "@whiskeysockets/baileys";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
  setCategoria,
  setCtwaReferral,
  setConversationPhoto,
} from "../db.js";
import { describirImagen, transcribirAudio } from "../media.js";
import { generateReply } from "../ai.js";
import { extractCtwaReferral, classifyCategoria } from "../classify.js";
import pino from "pino";
import fs from "fs";
import path from "path";

// Carpeta donde se guardan fotos/audios recibidos (volumen, persiste). El panel
// los sirve vía /api/media/<name> para verlos/escucharlos.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

// Extrae el texto del mensaje: texto plano, captions y algunos formatos
// especiales (plantillas/botones/listas) que si no se descartarían.
function extraerTexto(m: proto.IMessage | null | undefined): string | null {
  if (!m) return null;
  const tpl = m.templateMessage?.hydratedTemplate ?? m.templateMessage?.hydratedFourRowTemplate;
  const codigoBoton = (tpl?.hydratedButtons ?? [])
    .map((b) => b?.urlButton?.url ?? b?.quickReplyButton?.id ?? b?.callButton?.phoneNumber ?? "")
    .filter(Boolean)
    .join(" ");
  const desdePlantilla = [tpl?.hydratedContentText, codigoBoton].filter(Boolean).join(" ").trim();
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    (desdePlantilla || null) ||
    m.buttonsMessage?.contentText ||
    m.interactiveMessage?.body?.text ||
    m.listMessage?.description ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    null
  );
}

// Descarga la foto de perfil de WhatsApp del contacto y la guarda en data/media,
// registrándola en la conversación. Si no tiene foto o es privada, no hace nada
// (el panel muestra el avatar gris por defecto). Nunca lanza.
async function guardarFotoPerfil(sock: WASocket, jid: string, convId: number): Promise<void> {
  try {
    const url = await sock.profilePictureUrl(jid, "image").catch(() => null);
    if (!url) return;
    const resp = await fetch(url);
    if (!resp.ok) return;
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    const name = `avatar_${convId}.jpg`;
    fs.writeFileSync(path.join(MEDIA_DIR, name), buf);
    setConversationPhoto(convId, name);
    logger.info({ convId }, "📷 foto de perfil guardada");
  } catch (e) {
    logger.debug({ err: String(e).slice(0, 80) }, "no se pudo traer la foto de perfil");
  }
}

// Procesa FOTOS y AUDIOS: los descarga, guarda el archivo para verlo/escucharlo en
// el panel, y los convierte a texto (imagen → Claude la describe; audio →
// transcripción). Devuelve { text, media } o null si no es un medio soportado.
// Try/catch interno: un fallo nunca rompe el flujo de texto.
async function procesarMedia(
  sock: WASocket,
  msg: proto.IWebMessageInfo,
  inner: proto.IMessage | null | undefined
): Promise<{ text: string; media: string | null } | null> {
  if (!inner) return null;
  const img = inner.imageMessage;
  const aud = inner.audioMessage;
  const vid = inner.videoMessage;
  const sti = inner.stickerMessage;
  if (!img && !aud && !vid && !sti) return null;
  try {
    const buffer = (await downloadMediaMessage(
      { ...msg, message: inner },
      "buffer",
      {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    )) as Buffer;
    // Guardar el archivo para verlo/escucharlo/reproducirlo en el panel.
    let media: string | null = null;
    try {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
      const mt = (img?.mimetype ?? aud?.mimetype ?? vid?.mimetype ?? sti?.mimetype ?? "").toLowerCase();
      let ext: string;
      if (img) ext = mt.includes("png") ? "png" : mt.includes("webp") ? "webp" : "jpg";
      else if (sti) ext = "webp";
      else if (vid) ext = "mp4";
      // audio: nunca lo guardamos como .mp4 (eso lo reservamos para video)
      else ext = mt.includes("m4a") || mt.includes("mp4") ? "m4a" : mt.includes("mpeg") ? "mp3" : "ogg";
      media = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      fs.writeFileSync(path.join(MEDIA_DIR, media), buffer);
    } catch (e) {
      logger.warn({ err: String(e).slice(0, 80) }, "no se pudo guardar el medio");
    }
    if (img) {
      const desc = await describirImagen(buffer, img.mimetype ?? "image/jpeg");
      const cap = (img.caption ?? "").trim();
      const text = [cap, desc].filter(Boolean).join(" — ") || "📷 Foto";
      return { text, media };
    }
    if (sti) return { text: "🌟 Sticker", media };
    if (vid) {
      const cap = (vid.caption ?? "").trim();
      return { text: cap || "🎥 Video", media };
    }
    const txt = await transcribirAudio(buffer, aud!.mimetype ?? "audio/ogg");
    return { text: txt || "🎤 Audio", media };
  } catch (e) {
    logger.warn({ err: String(e).slice(0, 120) }, "procesarMedia falló");
    return null;
  }
}

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

    // Algunos mensajes vienen ENVUELTOS (temporales/ver-una-vez): el contenido
    // está adentro. Desenvolvemos para no perderlos.
    const inner =
      msg.message?.ephemeralMessage?.message ??
      msg.message?.viewOnceMessage?.message ??
      msg.message?.viewOnceMessageV2?.message ??
      msg.message;
    // Texto plano/captions primero; si no hay, intentar FOTO/AUDIO (los convierte a
    // texto y guarda el archivo para verlo/escucharlo en el panel).
    let text = extraerTexto(inner);
    let media: string | null = null;
    if (!text) {
      const m = await procesarMedia(sock, msg, inner);
      if (m) { text = m.text; media = m.media; logger.info({ remoteJid, media }, "📎 medio (foto/audio) recibido"); }
    }
    if (!text) continue;

    const phone = remoteJid.split("@")[0].split(":")[0];
    const name = msg.pushName ?? undefined;

    const convo = getOrCreateConversation(phone, name, remoteJid);
    insertMessage(convo.id, "user", text, media);
    // Foto de perfil: la traemos una vez (si no la tiene), sin bloquear la respuesta.
    if (!convo.photo) void guardarFotoPerfil(sock, remoteJid, convo.id);

    // Clasificación automática (solo si la usuaria no la movió a mano).
    // La señal CTWA (vino de anuncio) llega solo en el primer mensaje del contacto.
    const fresh0 = getConversationById(convo.id);
    if (fresh0 && fresh0.categoria_manual === 0) {
      const referral = extractCtwaReferral(msg.message as unknown as Record<string, unknown>);
      if (referral) setCtwaReferral(convo.id, referral);
      const categoria = classifyCategoria({ phone, ctwaReferral: referral });
      setCategoria(convo.id, categoria, false);
    }

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
