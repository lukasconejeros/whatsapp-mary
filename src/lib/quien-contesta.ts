import type { Categoria, ConversationMode } from "./db.js";

// ── A QUIÉN LE CONTESTA EL BOT (decisión de Lukas, 10-08-2026) ────────────────
//
// Este es el WhatsApp PERSONAL de Mary. El bot trabaja leads, no la vida de ella:
//
//   • "potencial" → llegó por un anuncio de Meta (señal dura click-to-WhatsApp,
//     `ctwa_referral`). El bot contesta SIEMPRE. Es plata pagada: dejarlo mudo es
//     el peor caso posible (Medifis #50 y #51).
//   • "mary" → número desconocido, sin señal de anuncio. El bot contesta y es el
//     FILTRO DE ENTRADA del prompt el que decide: si pregunta por el taller sigue,
//     y si es la amiga o la familia llama a silenciar().
//   • "arteluk" → apoderado que YA está en la lista de clientes. El bot se queda
//     callado: pagos, faltas y reclamos los ve Mary.
//
// Por qué esto vive en código y no en el prompt: hasta hoy TODAS las conversaciones
// nacían en HUMAN (`db.ts`, `mode ... DEFAULT 'HUMAN'`) y nada las encendía, así que
// el bot no le respondía solo a nadie — ni al lead del anuncio. Y dejarle al modelo
// la decisión de callar es justamente el error #51 de Medifis: metía la plantilla de
// Meta ("Quiero resolver una duda (anuncio)") en el saco de los mensajes que no se
// contestan, y se perdían leads pagados.
export function modoAutomatico(categoria: Categoria): ConversationMode {
  if (categoria === "arteluk") return "HUMAN";
  return "AI"; // potencial (anuncio) y mary (desconocido)
}

// ¿El bot puede tomar esta conversación por su cuenta?
//
// NO cuando alguien ya decidió a mano: Mary tocó el interruptor en el panel, o le
// escribió ella misma al contacto (por WhatsApp o desde la app), lo que apaga el bot
// en ese chat. Esa decisión manda para siempre y el automático no la pisa.
// Es el error #21 de Medifis / #20 de Anpalex: el interruptor le tiene que creer a la
// base, no reponerse solo al mensaje siguiente.
export function puedeDecidirElSistema(conv: { mode_manual?: number | null }): boolean {
  return !conv.mode_manual;
}

// ¿Esta conversación tiene derecho a respuesta sí o sí?
// El lead del anuncio nunca puede quedar mudo: ni por el filtro de entrada, ni porque
// el modelo devuelva vacío.
export function esLeadDeAnuncio(conv: { categoria?: string | null; ctwa_referral?: string | null }): boolean {
  return conv.categoria === "potencial" || !!conv.ctwa_referral;
}
