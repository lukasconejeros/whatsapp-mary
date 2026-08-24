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
