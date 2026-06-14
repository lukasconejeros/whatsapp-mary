import fs from "fs";
import path from "path";

const NEGOCIO_PATH = path.resolve(process.cwd(), "prompts", "negocio.md");

const FALLBACK_PROMPT = `Eres un asistente cordial que atiende clientes por WhatsApp.
Aún no tienes información del negocio configurada.
Tu objetivo es recopilar datos del lead (nombre, teléfono, necesidad principal).
Usa español neutro y conversacional. Máximo 3 líneas por mensaje. Una pregunta a la vez.
Si no puedes responder algo, usa la herramienta derivarHumano.`;

let _cached: string | null = null;
let _cachedMtime = 0;

// Lee el prompt estático desde prompts/negocio.md.
// Strip frontmatter YAML (--- ... ---) para que el LLM no lo vea.
// Cache en memoria hasta que cambie el archivo.
export function buildSystemPrompt(): string {
  try {
    if (!fs.existsSync(NEGOCIO_PATH)) return FALLBACK_PROMPT;

    const mtime = fs.statSync(NEGOCIO_PATH).mtimeMs;
    if (_cached && mtime === _cachedMtime) return _cached;

    let content = fs.readFileSync(NEGOCIO_PATH, "utf-8");

    // Strip YAML frontmatter
    if (content.startsWith("---")) {
      const end = content.indexOf("\n---", 4);
      if (end !== -1) content = content.slice(end + 4).trimStart();
    }

    _cached = content;
    _cachedMtime = mtime;
    return content;
  } catch {
    return FALLBACK_PROMPT;
  }
}
