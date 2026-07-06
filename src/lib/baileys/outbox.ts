import type { WASocket, AnyMessageContent } from "@whiskeysockets/baileys";
import {
  getPendingOutbox,
  getConversationById,
  markOutboxSent,
  bumpOutboxAttempt,
  markOutboxFailed,
} from "../db.js";
import pino from "pino";
import fs from "fs";
import path from "path";
import { esNombreMediaSeguro } from "../media-path.js";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

// Carpeta de medios (misma que usa el handler al recibir). Persiste en el volumen.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");

let outboxTimer: ReturnType<typeof setTimeout> | null = null;
let corriendo = false;

const INTERVALO_MS = 2000;

// Loop del outbox con BACKPRESSURE: cada pasada se reprograma con setTimeout SÓLO
// después de terminar la anterior. Antes era setInterval, que disparaba cada 2 s sin
// esperar; con envíos > 2 s (audio/foto) el siguiente tick releía los mismos items
// sent=0 y los reenviaba → el cliente recibía el mensaje 2-3 veces. El flag `corriendo`
// es un candado extra de reentrada.
export function startOutboxLoop(sock: WASocket): void {
  if (outboxTimer || corriendo) return;

  const tick = async () => {
    corriendo = true;
    try {
      await procesarPendientes(sock);
    } catch (err) {
      logger.error({ err }, "Outbox: error inesperado en la pasada");
    } finally {
      corriendo = false;
      // Reprograma DESPUÉS de terminar (nunca dos pasadas solapadas).
      outboxTimer = setTimeout(tick, INTERVALO_MS);
    }
  };

  outboxTimer = setTimeout(tick, 0);
}

async function procesarPendientes(sock: WASocket): Promise<void> {
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
          if (!esNombreMediaSeguro(item.media)) {
            // Nombre inseguro (path traversal): nunca leer fuera de data/media.
            logger.error({ id: item.id, media: item.media }, "Outbox: nombre de media inseguro, descartado");
            markOutboxSent(item.id);
            continue;
          }
          const file = path.join(MEDIA_DIR, item.media);
          if (!fs.existsSync(file)) {
            // Archivo perdido: no reintentar para siempre; marcar como enviado y seguir.
            logger.warn({ id: item.id, media: item.media }, "Outbox: archivo no encontrado, se omite");
            markOutboxSent(item.id);
            continue;
          }
          const buffer = fs.readFileSync(file);
          if (item.kind === "audio") {
            const ext = path.extname(item.media).toLowerCase();
            // 'content' guarda la duración en segundos (para que WhatsApp no marque 0:00).
            const seconds = parseInt(item.content || "0", 10) || undefined;
            if (ext === ".ogg" || ext === ".opus") {
              // Nota de voz real (push-to-talk) en opus/ogg — la reproduce WhatsApp.
              payload = { audio: buffer, ptt: true, mimetype: "audio/ogg; codecs=opus", seconds };
            } else {
              // Fallback (no se pudo transcodificar): audio normal, sin ptt, más compatible.
              const mimetype = ext === ".mp3" ? "audio/mpeg" : "audio/mp4";
              payload = { audio: buffer, mimetype, seconds };
            }
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
        // Reintenta hasta 5 veces; luego descarta el item para no bloquear la cola
        // (un poison-pill a la cabeza del ORDER BY dejaba sin salir a los mensajes nuevos).
        const n = bumpOutboxAttempt(item.id);
        if (n >= 5) {
          markOutboxFailed(item.id);
          logger.error({ id: item.id, n }, "Outbox: item descartado tras 5 intentos fallidos");
        } else {
          logger.error({ err, id: item.id, n }, "Error enviando outbox item; se reintentará");
        }
      }
    }
}

export function stopOutboxLoop(): void {
  if (outboxTimer) {
    clearTimeout(outboxTimer);
    outboxTimer = null;
  }
}
