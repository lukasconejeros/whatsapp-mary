// ── LAS PESTAÑAS DEL INBOX (decisión de Lukas, 19-08-2026) ───────────────────
//
// Antes había cuatro: Todos, Arteluk, Meta y Seguimiento. Mary se perdía. Ahora
// quedan DOS:
//
//   • Todos → todos los chats, sin excepción. Los apoderados (categoría "arteluk")
//     siguen aquí: se fue su pestaña, no sus conversaciones.
//   • Meta  → los leads del anuncio, HAYAN PAGADO O NO la clase de prueba. Antes
//     los que pagaban se iban a la pestaña Seguimiento; ahora se quedan en Meta
//     con una marca, y el envío de seguimiento vive dentro de Meta (selector).
//
// Esta lógica vive aquí y no en la pantalla para poder probarla sin navegador.

export type Pestana = "todos" | "meta";

/** Envío masivo que se está preparando dentro de la pestaña Meta. */
export type Envio = "meta" | "seguimiento";

export const PESTANAS: { key: Pestana; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "meta", label: "Meta" },
];

export interface ChatFiltrable {
  categoria?: string | null;
  cerrado?: number | boolean | null;
}

/** ¿Este chat se ve en esa pestaña? */
export function perteneceALaPestana(chat: ChatFiltrable, pestana: Pestana): boolean {
  if (pestana === "todos") return true;
  return chat.categoria === "potencial";
}

/**
 * ¿Hay que marcarlo como "Pagó" en la lista? Solo el lead de Meta que Mary cerró
 * con el botón del chat. Ahora que conviven en la misma pestaña, sin la marca no
 * se distinguen.
 */
export function pagoLaPrueba(chat: ChatFiltrable): boolean {
  return chat.categoria === "potencial" && !!chat.cerrado;
}

/** Tras tocar "Pagó la prueba" / "Volver a Meta", qué envío conviene mostrar. */
export function envioPorDefecto(cerrado: boolean): Envio {
  return cerrado ? "seguimiento" : "meta";
}
