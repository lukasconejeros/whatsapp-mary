// El saludo del bot, editable desde "Entrenar IA".
//
// QUÉ RESUELVE: hasta ahora la primera frase que leía una mamá nueva la improvisaba la IA con el
// prompt, así que Mary no tenía dónde escribirla y nunca salía dos veces igual. Ahora se escribe
// en el panel y se manda TAL CUAL, sin pasar por el modelo (un "hola" pelado deja de costar plata).
//
// DÓNDE VIVE: en la tabla `config`, la misma que usan los bloques de datos de Entrenar IA
// (ver secciones-negocio.ts). Por eso sobrevive a los deploys: si se guardara en `prompts/negocio.md`
// se borraría con cada imagen nueva del contenedor, que es justo el bug que se cerró el 10-08.
//
// EL ATAJO ES DELIBERADAMENTE ANGOSTO. El prompt manda que el primer mensaje de alguien nuevo SIEMPRE
// se conteste, así que responder de una no se salta ningún filtro. Pero cualquier otro caso sí lo
// haría: por eso NO dispara si Mary ya contestó a mano, si la conversación viene rodando, si el
// mensaje trae foto. Ver `saludoDeEntrada`.
// Sin extensión .js en el import: este módulo lo cargan la API de Next, el bot y los scripts.
import { getConfig, setConfig } from "./db";
import type { Message } from "./db";

const K_BIENVENIDA = "msg_bienvenida";

// El texto de fábrica es EXACTAMENTE el que el prompt manda decir hoy en el paso 1 de "El camino de
// la conversación" (prompts/negocio.md). Si nadie edita nada en el panel, nadie nota la diferencia.
export const DEFAULT_BIENVENIDA =
  "¡Hola! 😊 Soy Mary Quinteros, magíster en psicología, ingeniera y artista, y directora de Academia Arteluk. Cuénteme, ¿para quién sería la clase?";

// Vacío guardado NO es lo mismo que nunca guardado: si Mary borra la caja, quiere que vuelva a
// improvisar la IA. `getConfig` devuelve el valor guardado aunque sea "", y el de fábrica solo
// cuando no hay fila.
export function getBienvenida(): string {
  return getConfig(K_BIENVENIDA, DEFAULT_BIENVENIDA);
}

export function setBienvenida(texto: string): void {
  setConfig(K_BIENVENIDA, (texto || "").trim());
}

// Lo que NO se deja guardar. El saludo se manda TAL CUAL, así que un marcador tipo {nombre} le
// llegaría a la mamá con las llaves puestas, y un texto larguísimo se lee pésimo en WhatsApp.
// Vacío SÍ se deja guardar: es la forma de decir "que improvise la IA como antes".
export function validarBienvenida(texto: string): { ok: true } | { ok: false; motivo: string } {
  const t = (texto || "").trim();
  if (!t) return { ok: true };
  if (t.length < 5) return { ok: false, motivo: "El saludo es demasiado corto." };
  if (t.length > 400) return { ok: false, motivo: "El saludo es demasiado largo (máximo 400 letras)." };
  if (/\{[a-z_]+\}/i.test(t)) return { ok: false, motivo: "El saludo no admite marcadores como {nombre}: se envía tal cual." };
  return { ok: true };
}

// Quita emojis, tildes y signos para comparar. "Buenos días 👋" y "buenos dias" son lo mismo.
function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .trim();
}

// Saludo PURO: el mensaje entero es un saludo y nada más. "hola, cuánto vale" NO entra — eso lo
// contesta la IA con su flujo normal, que ya sabe responder la pregunta y saludar en la misma línea.
export function esSaludoPuro(mensaje: string): boolean {
  const t = norm(mensaje).replace(/[\s!,.¿?¡]+$/g, "");
  if (!t) return false;
  return /^(h?ola+s?|holi+s?|buenas|buenas tardes|buenas noches|buenos dias|buen dia|que tal|hey|saludos|alo)$/.test(t);
}

// Lo que llega SOLO por abrir la conversación y no pregunta nada: un saludo pelado, o el texto
// que WhatsApp manda solo al tocar el botón de un anuncio de Meta ("¡Hola! Quiero más información",
// "¡Hola! Me gustaría conseguir más información sobre esto."). Con esto no hace falta molestar al
// modelo: el saludo de Mary ya dice todo lo que hay que decir y además pregunta para quién es.
function esSoloEntrada(mensaje: string): boolean {
  const t = norm(mensaje).replace(/[!¡?¿.,;:]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return true;
  return /^(h?ola+s?|holi+s?|buenas|buenas tardes|buenas noches|buenos dias|buen dia|que tal|hey|saludos|alo)?\s*((me\s+)?(gustaria|interesa|interesaria|encantaria)|quiero|quisiera|queria|necesito|busco)?\s*(conseguir|obtener|recibir|tener|saber|pedir|solicitar)?\s*(mas\s+)?(informacion|info|datos)?\s*(sobre\s+esto|al\s+respecto|por\s+favor|porfavor|gracias)?$/.test(t);
}

// LA DECISIÓN. `texto` es el saludo de Mary a mandar tal cual (o "" si este caso no es suyo y
// contesta la IA como siempre). `ademasResponder` avisa de que en el mismo primer contacto
// preguntaron algo, y entonces la IA responde ESO en un segundo mensaje, sin volver a saludar.
//
// POR QUÉ SALE SIN PASAR POR EL MODELO (24-08-2026): el prompt ya le ordenaba decirlo "con ESAS
// palabras, sin adornos" y el modelo igual lo reescribía — "hola buenas un gusto" le salió como
// "¡Hola como estai!" y el "su nombre" de ella como "tu nombre" (conv 364 y 365). Mary lo corrigió
// a mano. La única forma de que salga palabra por palabra es no pasarlo por la IA.
//
// La familia completa, caso por caso:
//   · "hola" pelado, primer contacto            → su saludo tal cual, sin IA
//   · botón de Meta, primer contacto            → su saludo tal cual, sin IA
//   · "hola, ¿cuánto vale?"                     → su saludo tal cual + la IA contesta el precio
//   · saluda de nuevo a mitad de conversación   → IA (ya hay respuestas antes)
//   · Mary contestó a mano (role 'human')       → IA (no se le pisa el saludo)
//   · el saludo viene con foto o audio          → IA (la foto hay que mirarla)
//   · el 4º mensaje suyo sin respuesta          → IA (ya no es un primer contacto)
//   · la caja del panel vacía                   → IA (Mary la borró a propósito)
export function saludoDeEntrada(history: Message[]): { texto: string; ademasResponder: boolean } {
  const NADA = { texto: "", ademasResponder: false };
  const ultimo = history[history.length - 1];
  if (!ultimo || ultimo.role !== "user") return NADA;
  if (history.some((m) => m.media)) return NADA;
  // Ni el bot ni Mary escribieron todavía: 'human' son los mensajes que Mary manda desde su teléfono.
  if (history.some((m) => m.role !== "user")) return NADA;
  // Tope de mensajes: si insistió cuatro veces, ya no es el primer "hola" y merece una respuesta real.
  if (history.length > 3) return NADA;
  const texto = getBienvenida().trim();
  if (!texto) return NADA;
  return { texto, ademasResponder: history.some((m) => !esSoloEntrada(m.content)) };
}
