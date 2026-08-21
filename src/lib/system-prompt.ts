import fs from "fs";
import path from "path";
// Sin extensión .js, igual que ensayo.ts: con ella el bundler de Next no resuelve el módulo.
import { getOverridesRaw, parseOverrides, aplicarOverrides } from "./secciones-negocio";
import { getBienvenida, DEFAULT_BIENVENIDA } from "./mensajes";

const NEGOCIO_PATH = path.resolve(process.cwd(), "prompts", "negocio.md");

const FALLBACK_PROMPT = `Eres un asistente cordial que atiende clientes por WhatsApp.
Aún no tienes información del negocio configurada.
Tu objetivo es recopilar datos del lead (nombre, teléfono, necesidad principal).
Usa español neutro y conversacional. Máximo 3 líneas por mensaje. Una pregunta a la vez.
Si no puedes responder algo, usa la herramienta derivarHumano.`;

let _cached: string | null = null;
let _cachedMtime = 0;
let _cachedOverrides = "";
let _cachedSaludo = "";

// El cerebro del bot = las REGLAS de prompts/negocio.md (que mantiene el repo) con los DATOS que
// Mary edita en "Entrenar IA" encima (que viven en la base y sobreviven a los deploys).
// Se le quita el frontmatter YAML para que el modelo no lo vea.
//
// El saludo que Mary escribe en "Entrenar IA" entra por el marcador {{SALUDO}} del archivo, en los
// DOS sitios donde el prompt dictaba a mano la presentación. Sin esto, su texto solo salía cuando
// alguien escribía "hola" pelado: los leads del anuncio de Meta llegan con "¡Hola! Quiero más
// información", eso lo contesta el modelo, y el modelo seguía leyendo el saludo viejo del archivo
// (lo que reclamó Lukas el 21-08-2026).
//
// El caché mira TRES cosas, y las tres hacen falta: el archivo (cambia con cada deploy), lo que
// Mary tenga guardado en los bloques y su saludo. El panel y el bot son procesos DISTINTOS, así que si aquí solo se mirara
// el archivo, ella editaría, vería "guardado" y el bot seguiría contestando lo viejo hasta que
// alguien reiniciara el contenedor. Releer la fila cuesta microsegundos (SQLite síncrono).
export function buildSystemPrompt(): string {
  try {
    if (!fs.existsSync(NEGOCIO_PATH)) return FALLBACK_PROMPT;

    const mtime = fs.statSync(NEGOCIO_PATH).mtimeMs;
    const overridesRaw = getOverridesRaw();
    const saludo = getBienvenida();
    if (_cached && mtime === _cachedMtime && overridesRaw === _cachedOverrides && saludo === _cachedSaludo)
      return _cached;

    let content = fs.readFileSync(NEGOCIO_PATH, "utf-8");

    // Strip YAML frontmatter
    if (content.startsWith("---")) {
      const end = content.indexOf("\n---", 4);
      if (end !== -1) content = content.slice(end + 4).trimStart();
    }

    content = aplicarOverrides(content, parseOverrides(overridesRaw));
    // Caja vacía = "que improvise la IA como antes": entonces el prompt lleva el de fábrica, que es
    // el mismo que estaba escrito a mano hasta hoy. Nunca se le manda el marcador crudo al modelo.
    content = content.split("{{SALUDO}}").join(saludo.trim() || DEFAULT_BIENVENIDA);

    _cached = content;
    _cachedMtime = mtime;
    _cachedOverrides = overridesRaw;
    _cachedSaludo = saludo;
    return content;
  } catch {
    return FALLBACK_PROMPT;
  }
}
