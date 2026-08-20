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
// ¿El desconocido viene a preguntar por el taller, o es la vida personal de Mary?
//
// Hasta el 19-08-2026 esto lo decidía el MODELO leyendo el mensaje (el FILTRO DE ENTRADA del
// prompt), y por eso se le colaban respuestas a las amigas de ella cada vez que el filtro
// fallaba — además de gastar una llamada a la IA para descubrir que no había que contestar.
// Ahora la puerta la abre una regla dura y el prompt queda como segunda barrera, no como única.
//
// Se mira SOLO el primer mensaje que abre la conversación: una vez que el bot está encendido,
// nada de esto lo apaga a mitad (para eso están Mary y el interruptor del panel).
const SENALES_DE_TALLER: RegExp[] = [
  /\b(clase|clases|clasecita|taller|talleres|curso|cursos|academia)\b/,
  /\b(arte|pintura|pintar|dibujo|dibujar|ceramica|manualidades)\b/,
  /\b(precio|precios|valor|valores|cuesta|cuestan|vale|valen|mensualidad|arancel|matricula)\b/,
  /\bcuanto\b/,
  /\b(horario|horarios)\b/,
  /\b(info|informacion|informes)\b/,
  /\b(inscribir|inscripcion|inscribo|matricular|cupo|cupos|disponibilidad)\b/,
  /\b(prueba)\b/,                       // "clase de prueba", "quiero una prueba"
  /\b(direccion|ubicacion|donde\s+(qued|est|funcion|ubic))/,
  /\b(mi\s+(hijo|hija|nino|nina|pequeñ|peque))/,
];

function sinTildes(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function preguntaPorElTaller(texto: string): boolean {
  const t = sinTildes(texto);
  return SENALES_DE_TALLER.some((r) => r.test(t));
}

export interface ContextoDelMensaje {
  /** Lo que escribió (o lo que se transcribió del audio). */
  texto?: string;
  /** Cómo está la conversación AHORA: si el bot ya estaba encendido, no se apaga por un mensaje. */
  modoActual?: ConversationMode;
}

export function modoAutomatico(categoria: Categoria, ctx: ContextoDelMensaje = {}): ConversationMode {
  if (categoria === "arteluk") return "HUMAN";
  if (categoria === "potencial") return "AI"; // plata pagada: nunca se le calla

  // Desconocido: solo si viene a preguntar por el taller (decisión de Lukas, 19-08-2026,
  // incluido el "hola" pelado, que queda mudo hasta que diga para qué escribe).
  if (ctx.modoActual === "AI") return "AI";
  return preguntaPorElTaller(ctx.texto ?? "") ? "AI" : "HUMAN";
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
