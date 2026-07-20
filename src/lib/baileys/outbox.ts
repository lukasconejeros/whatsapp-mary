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
import { recordarSaliente } from "./msg-cache.js";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

// Carpeta de medios (misma que usa el handler al recibir). Persiste en el volumen.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");

let outboxTimer: ReturnType<typeof setTimeout> | null = null;
let corriendo = false;
let detenido = true;                    // sin conexión no se procesa nada
let sockActual: WASocket | null = null; // socket VIVO (se re-engancha en cada reconexión)

const INTERVALO_MS = 2000;

// Loop del outbox con BACKPRESSURE: cada pasada se reprograma con setTimeout SÓLO
// después de terminar la anterior (con setInterval se solapaban y duplicaban envíos).
//
// IMPORTANTE (bug de mensajes perdidos): antes el socket quedaba CAPTURADO en la
// clausura. Si el socket moría a mitad de una pasada, el `finally` revivía el loop con
// el socket MUERTO y `startOutboxLoop(nuevoSock)` se devolvía (veía el timer puesto) sin
// enganchar el socket nuevo → todos los envíos fallaban → a los 5 intentos se
// descartaban EN SILENCIO. Ahora el socket vive en `sockActual` y siempre se re-engancha.
export function startOutboxLoop(sock: WASocket): void {
  sockActual = sock; // re-engancha SIEMPRE el socket nuevo
  detenido = false;
  if (outboxTimer || corriendo) return; // ya hay loop vivo: usará el socket nuevo
  outboxTimer = setTimeout(tick, 0);
}

const tick = async (): Promise<void> => {
  outboxTimer = null;
  corriendo = true;
  try {
    // Sin socket vivo NO se intenta enviar: así no se queman los 5 reintentos durante
    // una caída (era otra vía por la que se perdían mensajes). Esperan a la reconexión.
    const s = sockActual;
    if (s && !detenido) await procesarPendientes(s);
  } catch (err) {
    logger.error({ err }, "Outbox: error inesperado en la pasada");
  } finally {
    corriendo = false;
    if (!detenido) outboxTimer = setTimeout(tick, INTERVALO_MS);
  }
};

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
        const sent = await sock.sendMessage(jid, payload);
        // Guardamos el mensaje enviado por si el contacto no logra descifrarlo y pide
        // el reenvío (Baileys lo recupera con getMessage). Sin esto, ese reenvío falla
        // y la sesión se desincroniza → se pierden mensajes ENTRANTES de ese contacto.
        if (sent?.key?.id && sent.message) recordarSaliente(sent.key.id, sent.message);
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
  // `detenido` evita que una pasada EN VUELO reprograme el loop después del stop
  // (eso dejaba un loop zombi con el socket muerto).
  detenido = true;
  sockActual = null;
  if (outboxTimer) {
    clearTimeout(outboxTimer);
    outboxTimer = null;
  }
}
