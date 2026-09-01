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
import { hourSantiago } from "./fechas";
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


// EL SALUDO SEGÚN LA HORA (encargo de Lukas, 24-08-2026)
//
// Reclamó: "no quiero que diga cómo estás en el hola, quiero buenos días / buenas tardes / buenas
// noches según la hora que sea, reactivo". El "hola como esta!" NO lo inventaba la IA: lo escribió
// Mary en la caja de Entrenar IA (leído en producción el 24-08 a las 13:55), y desde que el saludo
// sale palabra por palabra, salía tal cual.
//
// Por eso el cambio va acá y no en el prompt: se le reemplaza SOLO la apertura y el resto de su
// texto queda intacto, escriba lo que escriba. Tramos que eligió Lukas: días hasta las 12, tardes
// de 12 a 20, noches de 20 a 6. Alcance que eligió: solo el saludo de entrada.
export function saludoPorHora(hora: number = hourSantiago()): string {
  if (hora >= 6 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

// Las aperturas que se comen: el "hola", el "buenas" y las fórmulas de cortesía con las que
// arranca un saludo. Solo al principio del texto — el "buenas noticias" de más adentro no se toca.
// El (?!letra) del final es el que evita cortar una palabra por la mitad: sin él, "cómo están"
// dejaba una "n" suelta y "como estai" una "i" (cazados en el barrido de 30 variantes, 24-08).
const RE_APERTURA =
  /^[\s¡!¿?.,;:–—-]*(hol+a+s?|holi+s?|buenas\s+(tardes|noches|d[ií]as)|buenos\s+d[ií]as|buen\s+d[ií]a|buenas|hey|al[oó]|saludos|qu[eé]\s+tal|c[oó]mo\s+(est[aá]s?|estai|est[aá]n|le\s+va|te\s+va)|como\s+(estas?|estai|estan|le\s+va|te\s+va))(?![a-záéíóúñ0-9])[\s¡!¿?.,;:–—-]*/iu;

export function conSaludoDeHora(texto: string, hora: number = hourSantiago()): string {
  let resto = (texto || "").trim();
  if (!resto) return "";
  // Pueden venir varias piezas pegadas ("hola buenas", "hola como esta!"), por eso el bucle.
  // El tope de 4 vueltas es para que un texto raro no lo deje dando vueltas.
  for (let i = 0; i < 4; i++) {
    const limpio = resto.replace(RE_APERTURA, "");
    if (limpio === resto) break;
    resto = limpio;
  }
  const saludo = saludoPorHora(hora);
  if (!resto) return saludo;
  // Coma si lo que sigue va en minúscula ("Buenas tardes, un gusto"); punto si arranca en
  // mayúscula o con un emoji, porque "Buenas tardes, Soy Mary" se lee mal.
  return /^\p{Ll}/u.test(resto) ? `${saludo}, ${resto}` : `${saludo}. ${resto}`;
}

// EL VETO A QUE EL MODELO REPITA EL SALUDO (auditoría del 31-08-2026).
//
// Cuando en el primer contacto además preguntan algo, el saludo de Mary sale del código y la IA
// contesta a continuación, con la orden [YA_SALUDASTE: … NO te vuelvas a presentar]. No basta:
// en la conv 396 (31-08 22:51) el modelo devolvió el saludo ENTERO otra vez y a la mamá le llegó
// dos veces seguido en la misma burbuja. Es la lección #28 de la bitácora aplicada al revés: si
// una orden del prompt no se puede incumplir, se comprueba en el código.
function comparable(s: string): string {
  return norm(s).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
}

function seParecen(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  if (largo.includes(corto)) return true;
  const A = new Set(a.split(" ")), B = new Set(b.split(" "));
  let comunes = 0;
  for (const w of A) if (B.has(w)) comunes++;
  return comunes / new Set([...A, ...B]).size > 0.75;
}

// EL SEGUNDO VETO (01-09-2026, conv 398 9:25:19). El de arriba mira si el trozo SE PARECE al
// saludo entero, y eso solo caza la copia calcada. Hoy el modelo se volvió a presentar con otras
// palabras — "Hola, qué bueno que se comunique conmigo. Un gusto, mi nombre es Mary Quinteros,
// profesora de la academia Arteluk desde hace 5 años" — y pasó limpio (se parecen 0,50 y hace
// falta 0,75): a la mamá le llegó la presentación dos veces seguidas, la misma queja del día
// anterior. Lo que lo delata no es el parecido global sino el TROZO calcado palabra por palabra:
// seis palabras seguidas del saludo ("un gusto mi nombre es mary") ya son una presentación
// repetida. Con menos de seis hay falsos positivos de verdad: "en la academia Arteluk
// trabajamos..." es una frase legítima y comparte cuatro.
const PALABRAS_CALCADAS = 6;

// Y la pregunta con la que TERMINA el saludo no cuenta para este veto. Si el modelo vuelve a pedir
// el nombre está siendo redundante, pero puede estar añadiendo algo suyo en la misma frase — conv
// 378, 30-08: "Cuénteme cuál es su nombre y para quién sería la clase, ¿cuántos años tiene?" — y
// borrársela entera le quitaría la pregunta nueva. Lo que se veta es que se vuelva a PRESENTAR.
function laPresentacion(saludo: string): string {
  const t = (saludo || "").trim();
  if (!/[?]\s*$/.test(t)) return t;
  const sinFinal = t.replace(/[?\s]+$/, "");
  const corte = Math.max(sinFinal.lastIndexOf(","), sinFinal.lastIndexOf("."), sinFinal.lastIndexOf(";"));
  return corte > 0 ? sinFinal.slice(0, corte) : t;
}

function calcaUnTrozoDelSaludo(texto: string, saludo: string): boolean {
  const a = texto.split(" ").filter(Boolean);
  const b = saludo.split(" ").filter(Boolean);
  if (a.length < PALABRAS_CALCADAS || b.length < PALABRAS_CALCADAS) return false;
  const trozos = new Set<string>();
  for (let i = 0; i + PALABRAS_CALCADAS <= b.length; i++) trozos.add(b.slice(i, i + PALABRAS_CALCADAS).join(" "));
  for (let i = 0; i + PALABRAS_CALCADAS <= a.length; i++) {
    if (trozos.has(a.slice(i, i + PALABRAS_CALCADAS).join(" "))) return true;
  }
  return false;
}

/** La respuesta del modelo sin los trozos donde volvió a soltar el saludo. */
export function sinRepetirElSaludo(saludo: string, cola: string): string {
  const clave = comparable(saludo);
  const presentacion = comparable(laPresentacion(saludo));
  if (!clave || !cola.trim()) return (cola || "").trim();
  const quedan = cola
    .split(/\n\s*\n/)
    .map((parrafo) => {
      // Un párrafo entero calcado del saludo se va completo (el caso de la conv 396).
      if (seParecen(comparable(parrafo), clave)) return "";
      // Y si solo repitió una frase suelta del saludo, se va esa frase y el resto se queda.
      return parrafo
        .split(/(?<=[.!?¡¿])\s+/)
        .filter((frase) => {
          const f = comparable(frase);
          return f.length < 25 || !(seParecen(f, clave) || calcaUnTrozoDelSaludo(f, presentacion));
        })
        .join(" ")
        .trim();
    })
    .filter((p) => p.trim());
  return quedan.join("\n\n").trim();
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

// LO QUE WHATSAPP LE PEGA DELANTE AL MENSAJE DEL ANUNCIO (auditoría del 31-08-2026).
//
// Cuando el anuncio de Meta lleva un enlace, el mensaje no llega pelado: llega con una cabecera
// y saltos de línea antes de la plantilla. Textual de producción, conv 396, 31-08 22:50:42:
//     "Enlace:\n\n\n¡Hola! Quiero más información"
// Sin quitar ese "Enlace:" el mensaje deja de parecerse a la plantilla, el bot cree que le
// preguntaron algo y manda su saludo Y ADEMÁS le pide una respuesta al modelo — que repitió el
// saludo entero, palabra por palabra, en la misma burbuja. Es la captura que mandó Lukas.
const RE_CABECERA_WA = /^\s*(enlace|link|url|mensaje\s+reenviado|reenviado)\s*:\s*/i;

export function sinCabeceraDeWhatsApp(mensaje: string): string {
  let t = String(mensaje ?? "");
  // Puede venir más de una ("Enlace:" y debajo la plantilla), por eso el bucle con tope.
  for (let i = 0; i < 3; i++) {
    const limpio = t.replace(RE_CABECERA_WA, "").replace(/^[\s\n]+/, "");
    if (limpio === t) break;
    t = limpio;
  }
  return t.trim();
}

// Lo que llega SOLO por abrir la conversación y no pregunta nada: un saludo pelado, o el texto
// que WhatsApp manda solo al tocar el botón de un anuncio de Meta ("¡Hola! Quiero más información",
// "¡Hola! Me gustaría conseguir más información sobre esto."). Con esto no hace falta molestar al
// modelo: el saludo de Mary ya dice todo lo que hay que decir y además pregunta para quién es.
function esSoloEntrada(mensaje: string): boolean {
  const t = norm(sinCabeceraDeWhatsApp(mensaje)).replace(/[!¡?¿.,;:]/g, " ").replace(/\s+/g, " ").trim();
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
  // La apertura la pone la hora ("Buenas tardes, un gusto…"), el resto es de ella palabra por palabra.
  return { texto: conSaludoDeHora(texto), ademasResponder: history.some((m) => !esSoloEntrada(m.content)) };
}
