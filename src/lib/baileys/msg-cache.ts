import type { proto } from "@whiskeysockets/baileys";

// Caché en memoria de los últimos mensajes que ENVIAMOS (id de WhatsApp → contenido).
// Baileys lo pide vía `getMessage` cuando un contacto NO pudo descifrar un mensaje
// NUESTRO y solicita el reenvío: sin esto, ese mensaje se perdía y además la sesión
// quedaba desincronizada (los siguientes mensajes de ese contacto fallaban con
// "Bad MAC" y se perdían al RECIBIR). Límite acotado para no crecer sin fin; se
// vacía al reiniciar (aceptable: solo afecta reenvíos de mensajes muy recientes).
const MAX = 800;
const cache = new Map<string, proto.IMessage>();

export function recordarSaliente(
  id: string | null | undefined,
  message: proto.IMessage | null | undefined
): void {
  if (!id || !message) return;
  if (cache.has(id)) cache.delete(id); // refresca el orden (LRU simple)
  cache.set(id, message);
  if (cache.size > MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function recuperarSaliente(id: string | null | undefined): proto.IMessage | undefined {
  if (!id) return undefined;
  return cache.get(id);
}
