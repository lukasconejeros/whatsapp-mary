import fs from "fs";
import path from "path";
// Sin extensión .js, igual que ensayo.ts: con ella el bundler de Next no resuelve el módulo.
import { getOverridesRaw, parseOverrides, aplicarOverrides } from "./secciones-negocio";

const NEGOCIO_PATH = path.resolve(process.cwd(), "prompts", "negocio.md");

const FALLBACK_PROMPT = `Eres un asistente cordial que atiende clientes por WhatsApp.
Aún no tienes información del negocio configurada.
Tu objetivo es recopilar datos del lead (nombre, teléfono, necesidad principal).
Usa español neutro y conversacional. Máximo 3 líneas por mensaje. Una pregunta a la vez.
Si no puedes responder algo, usa la herramienta derivarHumano.`;

let _cached: string | null = null;
let _cachedMtime = 0;
let _cachedOverrides = "";

// El cerebro del bot = las REGLAS de prompts/negocio.md (que mantiene el repo) con los DATOS que
// Mary edita en "Entrenar IA" encima (que viven en la base y sobreviven a los deploys).
// Se le quita el frontmatter YAML para que el modelo no lo vea.
//
// El caché mira DOS cosas, y las dos hacen falta: el archivo (cambia con cada deploy) y lo que
// Mary tenga guardado. El panel y el bot son procesos DISTINTOS, así que si aquí solo se mirara
// el archivo, ella editaría, vería "guardado" y el bot seguiría contestando lo viejo hasta que
// alguien reiniciara el contenedor. Releer la fila cuesta microsegundos (SQLite síncrono).
export function buildSystemPrompt(): string {
  try {
    if (!fs.existsSync(NEGOCIO_PATH)) return FALLBACK_PROMPT;

    const mtime = fs.statSync(NEGOCIO_PATH).mtimeMs;
    const overridesRaw = getOverridesRaw();
    if (_cached && mtime === _cachedMtime && overridesRaw === _cachedOverrides) return _cached;

    let content = fs.readFileSync(NEGOCIO_PATH, "utf-8");

    // Strip YAML frontmatter
    if (content.startsWith("---")) {
      const end = content.indexOf("\n---", 4);
      if (end !== -1) content = content.slice(end + 4).trimStart();
    }

    content = aplicarOverrides(content, parseOverrides(overridesRaw));

    _cached = content;
    _cachedMtime = mtime;
    _cachedOverrides = overridesRaw;
    return content;
  } catch {
    return FALLBACK_PROMPT;
  }
}
