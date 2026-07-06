import type { WASocket, AnyMessageContent } from "@whiskeysockets/baileys";
import {
  getPendingOutbox,
  getConversationById,
  markOutboxSent,
} from "../db.js";
import pino from "pino";
import fs from "fs";
import path from "path";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

// Carpeta de medios (misma que usa el handler al recibir). Persiste en el volumen.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");

let outboxTimer: ReturnType<typeof setInterval> | null = null;

export function startOutboxLoop(sock: WASocket): void {
  if (outboxTimer) return;

  outboxTimer = setInterval(async () => {
    const pending = getPendingOutbox(20);
    for (const item of pending) {
      try {
        const convo = getConversationById(item.conversation_id);
        // Use stored jid to support @lid addresses; fallback to @s.whatsapp.net
        const jid = convo?.jid ?? `${item.phone}@s.whatsapp.net`;
        // kind='image' → mandar la foto (content es el caption, opcional).
        // Cualquier otro valor (incl. 'text' o null en filas viejas) → texto.
        let payload: AnyMessageContent;
        if ((item.kind === "image" || item.kind === "audio") && item.media) {
          const file = path.join(MEDIA_DIR, item.media);
          if (!fs.existsSync(file)) {
            // Archivo perdido: no reintentar para siempre; marcar como enviado y seguir.
            logger.warn({ id: item.id, media: item.media }, "Outbox: archivo no encontrado, se omite");
            markOutboxSent(item.id);
            continue;
          }
          const buffer = fs.readFileSync(file);
          if (item.kind === "audio") {
            // Nota de voz (push-to-talk). El opus dentro de webm/ogg es compatible;
            // los .m4a/.mp4 (iPhone) van como audio/mp4.
            const ext = path.extname(item.media).toLowerCase();
            const mimetype = ext === ".m4a" || ext === ".mp4" ? "audio/mp4" : "audio/ogg; codecs=opus";
            payload = { audio: buffer, ptt: true, mimetype };
          } else {
            payload = item.content ? { image: buffer, caption: item.content } : { image: buffer };
          }
        } else {
          payload = { text: item.content };
        }
        await sock.sendMessage(jid, payload);
        markOutboxSent(item.id);
        logger.debug({ id: item.id, jid, kind: item.kind }, "Outbox mensaje enviado");
      } catch (err) {
        // Leave sent=0 so it retries on next tick
        logger.error({ err, id: item.id }, "Error enviando outbox item");
      }
    }
  }, 2000);
}

export function stopOutboxLoop(): void {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
}
