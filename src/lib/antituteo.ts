// LA REGLA ANTITUTEO — encargo de Lukas, 24-08-2026.
//
// Mary trata de usted a los apoderados. El bot no: escribió su saludo con "cuéntame cuál es SU
// nombre" y el bot lo mandó como "cuál es TU nombre", saludando además con un "¡Hola como estai!"
// que copió del ejemplo de charla personal del propio prompt. Ella entró a corregirlo a mano
// (conv 365, 24-08 12:29). Lukas: usted con TODOS, siempre, en todos los chats.
//
// QUÉ ES ESTO Y QUÉ NO: un detector para revisar los textos que escribimos NOSOTROS — los fijos
// del código y los ejemplos del prompt, que son los que el modelo copia tal cual. NO corrige la
// gramática de lo que improvisa el modelo: eso lo manda la orden del prompt.
//
// Solo entran palabras que en un mensaje a una apoderada NO pueden ser otra cosa. "mira",
// "escribe", "toma" o "confirma" quedan fuera a propósito: también son tercera persona ("ella
// mira"), y un detector que grita de más se termina apagando.

/** Palabras que solo existen tuteando. Se comparan sin tildes y como palabra entera. */
const TUTEOS = [
  // pronombres
  "tu", "tus", "ti", "te", "contigo", "tuyo", "tuya", "tuyos", "tuyas",
  // verbos en segunda persona del singular
  "eres", "tienes", "puedes", "quieres", "sabes", "vienes", "traes", "vas", "vives",
  "necesitas", "prefieres", "dices", "haces", "quisieras", "podrias", "querias",
  "tendrias", "estabas", "estuviste", "tuviste", "pudiste", "quisiste", "dijiste",
  // imperativos que no se confunden con la tercera persona
  "dime", "cuentame", "mandame", "escribeme", "avisame", "cuentanos", "traela", "traelo",
  // el tuteo chileno de la calle
  "estai", "teni", "tenis", "podi", "vai", "soi", "sabi", "querii", "hablai", "erii",
];

const RE_TUTEO = new RegExp(`\\b(${TUTEOS.join("|")})\\b`, "g");

function sinTildes(s: string): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Las formas de tuteo que trae el texto, sin repetir. Vacío = trata de usted.
 * `["tu", "tienes"]` = hay que reescribirlo.
 */
export function detectarTuteo(texto: string): string[] {
  const encontradas = sinTildes(texto).match(RE_TUTEO) ?? [];
  return [...new Set(encontradas)];
}

// ── EL CORRECTOR DE SALIDA (auditoría del 31-08-2026) ────────────────────────
//
// QUÉ CAMBIA respecto de lo de arriba: el detector solo miraba los textos que escribimos
// NOSOTROS, porque se dio por hecho que la orden del prompt bastaba para lo que improvisa el
// modelo. La medición dice que no: de los 100 mensajes que el bot mandó entre el 20 y el 31 de
// agosto, **23 tutean a una apoderada** — "Puedes elegir el horario" (conv 396, 31-08 23:22),
// "¿Te gustaría que le guarde un cupo?" (conv 377), "Qué hermoso que tu hija ame pintar"
// (conv 355) — con la orden "DE USTED, SIEMPRE Y CON TODOS" escrita en mayúsculas en el prompt.
// Es la misma lección de Anpalex: cuando un texto NO puede salir mal, el veto va en el código.
//
// EL ALCANCE, a propósito angosto: solo lo que lee un apoderado, o sea la respuesta del bot en
// `generateReplyDetallado`. Los avisos del pase de lista, el feedback y la práctica de Mary
// siguen tuteando: ella no es la apoderada.
//
// Cada entrada es una palabra que tuteando NO puede ser otra cosa. Nada de reglas por
// terminación: "arte" acabaría en "arle" en una academia de arte.
const A_USTED: Record<string, string> = {
  // pronombres
  "tú": "usted", "ti": "usted", "contigo": "con usted",
  "tu": "su", "tus": "sus", "tuyo": "suyo", "tuya": "suya", "tuyos": "suyos", "tuyas": "suyas",
  "te": "le",
  // presente
  "eres": "es", "estás": "está", "tienes": "tiene", "puedes": "puede", "quieres": "quiere",
  "sabes": "sabe", "vienes": "viene", "traes": "trae", "vas": "va", "vives": "vive",
  "necesitas": "necesita", "prefieres": "prefiere", "dices": "dice", "haces": "hace",
  "pasas": "pasa", "continúas": "continúa", "buscas": "busca", "piensas": "piensa",
  "escribes": "escribe", "llegas": "llega", "conoces": "conoce", "esperas": "espera",
  // condicional, pasado y subjuntivo
  "quisieras": "quisiera", "podrías": "podría", "querías": "quería", "tendrías": "tendría",
  "gustaría": "gustaría", "estabas": "estaba", "estuviste": "estuvo", "tuviste": "tuvo",
  "pudiste": "pudo", "quisiste": "quiso", "dijiste": "dijo", "viniste": "vino",
  // imperativos (los que no se confunden con la tercera persona)
  "dime": "dígame", "dame": "deme", "cuéntame": "cuénteme", "cuéntanos": "cuéntenos",
  "mándame": "mándeme", "escríbeme": "escríbame", "avísame": "avíseme", "mándanos": "mándenos",
  "tráela": "tráigala", "tráelo": "tráigalo", "elige": "elija", "ven": "venga",
  // infinitivo con el "te" pegado — lista cerrada, nunca por terminación
  "ayudarte": "ayudarle", "invitarte": "invitarle", "inscribirte": "inscribirle",
  "contarte": "contarle", "decirte": "decirle", "mostrarte": "mostrarle",
  "confirmarte": "confirmarle", "guardarte": "guardarle", "escribirte": "escribirle",
  "avisarte": "avisarle", "esperarte": "esperarle", "atenderte": "atenderle",
  "verte": "verle", "traerte": "traerle", "darte": "darle", "hacerte": "hacerle",
  "conocerte": "conocerle", "explicarte": "explicarle", "enviarte": "enviarle",
  "mandarte": "mandarle", "pasarte": "pasarle", "acompañarte": "acompañarle",
  // el tuteo chileno de la calle
  "estai": "está", "teni": "tiene", "tenis": "tiene", "podi": "puede", "vai": "va",
  "soi": "es", "sabi": "sabe", "hablai": "habla", "erii": "es", "querii": "quiere",
};

// Las claves sin tilde, para cuando el modelo se come un acento ("continuas", "podrias").
// "tu" queda fuera a propósito: sin tilde no se sabe si es "tú" (usted) o "tu" (su), y ya
// está resuelta arriba con su forma exacta.
const A_USTED_SIN_TILDE: Record<string, string> = {};
for (const [k, v] of Object.entries(A_USTED)) {
  const plano = sinTildes(k);
  if (plano !== k && !(plano in A_USTED)) A_USTED_SIN_TILDE[plano] = v;
}

/** Deja la palabra nueva con la misma caja que traía la vieja ("Te" → "Le", "TE" → "LE"). */
function mismaCaja(vieja: string, nueva: string): string {
  if (vieja === vieja.toUpperCase() && vieja.length > 1) return nueva.toUpperCase();
  if (vieja[0] === vieja[0]?.toUpperCase()) return nueva[0].toUpperCase() + nueva.slice(1);
  return nueva;
}

/**
 * Reescribe de usted lo que venga tuteando. Lo que ya trata de usted sale idéntico, y pasarlo
 * dos veces da lo mismo que pasarlo una.
 */
export function deUsted(texto: string): string {
  if (!texto) return "";
  return String(texto).replace(/\p{L}+/gu, (palabra) => {
    const baja = palabra.toLowerCase();
    const nueva = A_USTED[baja] ?? A_USTED_SIN_TILDE[sinTildes(baja)];
    return nueva ? mismaCaja(palabra, nueva) : palabra;
  });
}
