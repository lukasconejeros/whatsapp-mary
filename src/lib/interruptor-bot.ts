// ── EL INTERRUPTOR DEL BOT DENTRO DEL CHAT (encargo de Lukas, 19-08-2026) ─────
//
// Textual: "un boton muy claro de apagar bot". Hasta hoy el panel solo mostraba
// una etiqueta ("● Bot activo") que no se podía tocar: Mary veía el estado pero
// no tenía forma de apagarlo desde la app.
//
// Es el interruptor del chat abierto, NO uno maestro (decisión suya al preguntarle).
// Apagar o encender aquí es una decisión de persona: `setMode` marca `mode_manual`
// y el automático de quien-contesta.ts ya no vuelve a tocar ese chat.

import type { ConversationMode } from "./db.js";

/** Lo que hace el botón según cómo esté el bot ahora. */
export function siguienteModo(botActive: boolean): ConversationMode {
  return botActive ? "HUMAN" : "AI";
}

export interface TextoInterruptor {
  /** Cómo está ahora, en cristiano. */
  estado: string;
  /** Lo que va a pasar si lo aprieta. */
  accion: string;
}

export function textoInterruptor(botActive: boolean): TextoInterruptor {
  return botActive
    ? { estado: "El bot está contestando", accion: "Apagar bot" }
    : { estado: "El bot está apagado", accion: "Encender bot" };
}
