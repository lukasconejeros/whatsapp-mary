// Registro EN MEMORIA de los ids de mensajes que el OUTBOX acaba de enviar. Vive en el
// proceso del bot (el mismo que corre outbox y handler). Sirve para distinguir, cuando
// WhatsApp devuelve el "eco" de un mensaje saliente (messages.upsert con key.fromMe=true):
//   (a) lo envió el BOT por el outbox → ya se guardó en `messages` al encolar → IGNORAR el eco.
//   (b) lo escribió MARY directo desde su teléfono / WhatsApp Web → NO está en el panel →
//       guardarlo como "human" para que la conversación refleje lo que ella respondió.
// Sin esto, el handler descartaba TODO fromMe y lo escrito desde el teléfono desaparecía.
const ids = new Map<string, number>();
const TTL_MS = 10 * 60_000; // 10 min: de sobra para que llegue el eco (llega en segundos).

function limpiar(ahora: number): void {
  for (const [k, t] of ids) if (ahora - t > TTL_MS) ids.delete(k);
}

// El outbox llama esto justo después de sock.sendMessage, con el id que devolvió WhatsApp.
export function registrarEnvioOutbox(id: string): void {
  const ahora = Date.now();
  ids.set(id, ahora);
  if (ids.size > 1000) limpiar(ahora); // cota de memoria: nunca crece sin límite.
}

// true = este id lo envió el bot por el outbox (ignorar su eco). NO se borra al consultar:
// si WhatsApp reenvía el mismo eco tras una reconexión, también debe ignorarse.
export function fueEnvioOutbox(id: string): boolean {
  const t = ids.get(id);
  if (t === undefined) return false;
  if (Date.now() - t > TTL_MS) { ids.delete(id); return false; }
  return true;
}
