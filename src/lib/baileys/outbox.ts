import type { WASocket } from "@whiskeysockets/baileys";
import {
  getPendingOutbox,
  getConversationById,
  markOutboxSent,
} from "../db.js";
import pino from "pino";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

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
        await sock.sendMessage(jid, { text: item.content });
        markOutboxSent(item.id);
        logger.debug({ id: item.id, jid }, "Outbox mensaje enviado");
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
