/**
 * Motor del CHAT DE ENSAYO.
 *
 * Mary escribe haciéndose pasar por un apoderado y el bot le responde con el MISMO
 * cerebro que usaría en WhatsApp (`prompts/negocio.md`) y las MISMAS herramientas.
 * La diferencia, y es la razón de que este archivo exista: aquí **ninguna herramienta
 * se ejecuta de verdad**. No se apaga ninguna conversación, no se deriva a nadie, no
 * se guarda ningún lead. Se anota lo que HABRÍA pasado y se le muestra a Mary.
 */
// Sin extensión .js: este módulo lo importan la API de Next y los scripts (db.ts hace igual).
import { buildSystemPrompt } from "./system-prompt";
import { toolDefinitions } from "./tools/index";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_VUELTAS = 6;
const MAX_TOKENS = 1024;

export type RolEnsayo = "apoderado" | "bot";
export type TurnoEnsayo = { rol: RolEnsayo; texto: string };

export type RespuestaEnsayo = {
  texto: string;        // lo que le llegaría al apoderado por WhatsApp
  acciones: string[];   // lo que el bot HABRÍA hecho, en cristiano
  demoraMs: number;     // cuánto habría tardado en llegar, con el ritmo real
};

// ── Lo que habría hecho cada herramienta, sin hacerlo ──────────────────────────
// Devuelve el aviso para Mary y el resultado que se le entrega al modelo para que
// siga la conversación como si la herramienta hubiera funcionado.
export function simularHerramienta(
  nombre: string,
  args: Record<string, unknown>
): { aviso: string; resultado: Record<string, unknown> } {
  switch (nombre) {
    case "silenciar":
      return {
        aviso: "Aquí no habría contestado nada: entendió que el mensaje no es del taller.",
        resultado: { ok: true, silenciado: true },
      };
    case "derivarHumano": {
      const razon = typeof args.razon === "string" && args.razon.trim() ? args.razon.trim() : "";
      return {
        aviso: "Aquí te habría pasado la conversación a ti" + (razon ? ` (${razon})` : "") + ".",
        resultado: { ok: true, derivado: true },
      };
    }
    case "marcar_interes":
      return {
        aviso: "Aquí lo habría marcado como interesado en el seguimiento.",
        resultado: { ok: true, marcado: true },
      };
    case "guardarLead": {
      const n = typeof args.nombre === "string" ? args.nombre : "";
      return {
        aviso: "Aquí habría guardado los datos" + (n ? ` de ${n}` : "") + " en la lista de contactos.",
        resultado: { ok: true, guardado: true },
      };
    }
    default:
      return {
        aviso: `Intentó usar una herramienta que no existe (${nombre}).`,
        resultado: { ok: false, message: "Herramienta desconocida: " + nombre },
      };
  }
}

// ── El ritmo real ─────────────────────────────────────────────────────────────
// No es un número inventado: son los mismos valores que usa el bot en WhatsApp
// (handler.ts). Espera a que la persona termine de escribir y luego "tipea".
function numEnv(name: string, def: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) ? v : def;
}

export function demoraRealMs(aleatorio = Math.random()): number {
  const debounce = numEnv("REPLY_DEBOUNCE_MS", 25000);
  const min = numEnv("REPLY_DELAY_MIN", 1000);
  const max = numEnv("REPLY_DELAY_MAX", 3500);
  return Math.round(debounce + min + aleatorio * (max - min));
}

// ── El motor ──────────────────────────────────────────────────────────────────
type Contenido =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type MensajeApi = { role: "user" | "assistant"; content: string | Contenido[] };

function herramientasParaAnthropic() {
  return toolDefinitions.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

async function pedirAnthropic(system: string, messages: MensajeApi[], apiKey: string) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ENSAYO_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: MAX_TOKENS,
      system,
      tools: herramientasParaAnthropic(),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`La IA respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { content: Contenido[]; stop_reason?: string };
}

/**
 * Responde un turno del ensayo. `turnos` es la conversación completa hasta ahora,
 * incluyendo el último mensaje del apoderado.
 */
export async function responderEnsayo(turnos: TurnoEnsayo[]): Promise<RespuestaEnsayo> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY para el chat de ensayo.");

  const acciones: string[] = [];
  const messages: MensajeApi[] = turnos.map((t) => ({
    role: t.rol === "apoderado" ? "user" : "assistant",
    content: t.texto,
  }));

  // El historial no puede empezar por el bot ni llevar dos turnos seguidos del mismo lado.
  while (messages.length && messages[0].role === "assistant") messages.shift();
  if (!messages.length) throw new Error("El ensayo necesita al menos un mensaje del apoderado.");

  const system = buildSystemPrompt();
  let texto = "";

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const data = await pedirAnthropic(system, messages, apiKey);

    const textos = data.content.filter((c): c is Extract<Contenido, { type: "text" }> => c.type === "text");
    const usos = data.content.filter((c): c is Extract<Contenido, { type: "tool_use" }> => c.type === "tool_use");

    // El modelo suele escribir el mensaje EN LA MISMA vuelta en que pide una herramienta,
    // y quedarse callado en la vuelta siguiente. Si aquí se pisara el texto, la respuesta
    // llegaría vacía y el apoderado se quedaría sin contestación: se acumula, no se pisa.
    const nuevo = textos.map((t) => t.text).join(" ").trim();
    if (nuevo) texto = texto ? `${texto} ${nuevo}` : nuevo;

    if (!usos.length) break;

    messages.push({ role: "assistant", content: data.content });
    const resultados: Contenido[] = [];
    for (const uso of usos) {
      const { aviso, resultado } = simularHerramienta(uso.name, uso.input ?? {});
      acciones.push(aviso);
      resultados.push({ type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(resultado) });
    }
    messages.push({ role: "user", content: resultados });
  }

  return { texto, acciones, demoraMs: demoraRealMs() };
}
