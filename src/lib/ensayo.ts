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
import type { AudioMary, EnsayoMensaje } from "./db";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_VUELTAS = 6;
// Con razonamiento encendido, `max_tokens` tiene que ser MAYOR que el presupuesto de
// razonamiento: es el total, no lo que sobra para la respuesta. Con los 1024 de antes la
// API rechazaba la petición entera y Mary veía el bot mudo.
const MAX_TOKENS = 3072;
// 1024 es el mínimo que acepta Anthropic si algún día se vuelve a encender.
export const RAZONAMIENTO_TOKENS = 1024;
/**
 * Razonamiento APAGADO por defecto, y medido antes de apagarlo (Lukas, 10-08-2026: "si el sin
 * razonamiento alcanza, igual está bien, la idea es que gaste pocos tokens"). Mismos aciertos
 * en los dos arneses reales, la mitad de tiempo y 3,3 veces menos tokens de salida.
 * `RAZONAMIENTO_ENSAYO=1024` lo enciende otra vez, aquí y en el bot (ai.ts lee la misma
 * variable: si se separan, Mary ensaya con un bot que no es el que atiende).
 */
export function presupuestoRazonamiento(): number {
  const v = parseInt(process.env.RAZONAMIENTO_ENSAYO ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/** Lo que llevan gastado las llamadas de este proceso, para comparar coste con y sin pensar. */
export const usoEnsayo = { llamadas: 0, entrada: 0, salida: 0 };

/** Una línea con lo que costó la corrida. Precios de Haiku 4.5: USD 1 y 5 por millón. */
export function resumenUso(ms: number): string {
  const { llamadas, entrada, salida } = usoEnsayo;
  const usd = entrada / 1e6 + (salida / 1e6) * 5;
  const p = presupuestoRazonamiento();
  return `⏱️  ${(ms / 1000).toFixed(1)} s · ${llamadas} llamadas · ${entrada} tokens de entrada y ${salida} de salida · ~USD ${usd.toFixed(4)} · razonamiento ${p > 0 ? `${p} tokens` : "APAGADO"}`;
}

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
/**
 * La herramienta para proponer un audio de Mary existe SOLO en el ensayo: el bot de
 * WhatsApp de verdad no la tiene (por eso no se toca el registro de tools). El modelo
 * únicamente puede elegir un id de la lista que grabó ella: no inventa audios ni
 * situaciones. Si no ha grabado ninguno, la herramienta ni se ofrece.
 */
/**
 * Cómo se nombra un audio: por lo que Mary escribió en "cuándo hay que mandarlo", que
 * desde el 09-08-2026 es lo único que se le pide. Los audios de antes, que llevaban un
 * nombre aparte, caen a ese nombre para no quedar anónimos.
 */
function comoSeLlama(a: AudioMary): string {
  return a.cuando_usarlo.trim() || a.titulo.trim() || `audio ${a.id}`;
}

export function definicionProponerAudio(audios: AudioMary[]) {
  if (!audios.length) return null;
  const lista = audios
    .map((a) => `- id ${a.id}: ${comoSeLlama(a)}`)
    .join("\n");
  return {
    name: "proponerAudio",
    description:
      "Propone mandarle a la persona una nota de voz grabada por Mary. NO la envía: " +
      "Mary la revisa y decide. Úsala solo si la situación calza con una de estas:\n" + lista,
    input_schema: {
      type: "object",
      properties: { id: { type: "number", description: "El id del audio de la lista" } },
      required: ["id"],
    },
  };
}

export function simularHerramienta(
  nombre: string,
  args: Record<string, unknown>,
  audios: AudioMary[] = []
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
    case "proponerAudio": {
      const id = Number(args.id);
      const audio = audios.find((a) => a.id === id);
      if (!audio) {
        return {
          aviso: "Quiso proponerte un audio que no existe.",
          resultado: { ok: false, message: "No existe un audio con ese id" },
        };
      }
      return {
        aviso: `Aquí te habría propuesto este audio tuyo: "${comoSeLlama(audio)}". Tú decides si se manda.`,
        resultado: { ok: true, propuesto: comoSeLlama(audio) },
      };
    }
    default:
      return {
        aviso: `Intentó usar una herramienta que no existe (${nombre}).`,
        resultado: { ok: false, message: "Herramienta desconocida: " + nombre },
      };
  }
}

// ── Lo que leemos nosotros después ────────────────────────────────────────────
/**
 * La tarde entera en texto plano: cada pregunta, cada respuesta, cada corrección de
 * Mary y sus audios con el "cuándo usarlo" en sus palabras. Es el material con el que
 * armamos el cerebro definitivo del bot.
 */
export function armarInforme(mensajes: EnsayoMensaje[], audios: AudioMary[]): string {
  const l: string[] = ["ENTRENAMIENTO DEL BOT DE ARTELUK", ""];
  let sesion = -1;
  for (const m of mensajes) {
    if (m.sesion_id !== sesion) {
      sesion = m.sesion_id;
      l.push("", `── Práctica ${sesion} ──`, "");
    }
    l.push(`${m.rol === "apoderado" ? "MARY (haciendo de apoderado)" : "BOT"}: ${m.texto || "(no contestó nada)"}`);
    if (m.acciones) {
      try {
        for (const a of JSON.parse(m.acciones) as string[]) l.push(`   [${a}]`);
      } catch { /* acciones ilegibles: se omiten, el informe igual sale */ }
    }
    if (m.malo) l.push("   ⚠️ Mary marcó: esto yo no lo diría");
    if (m.correccion) l.push(`   ✏️ Tú dirías: ${m.correccion}`);
    if (m.correccion_audio) l.push(`   🎤 Lo dijo hablando: ${m.correccion_audio} (${m.correccion_seg ?? 0} s)`);
  }
  l.push("", "", "── AUDIOS DE MARY ──", "");
  if (!audios.length) l.push("(todavía no grabó ninguno)");
  for (const a of audios) {
    l.push(`• CUÁNDO USARLO (palabras de Mary): ${comoSeLlama(a)}`);
    l.push(`  archivo ${a.archivo} (${a.segundos} s)`);
  }
  return l.join("\n");
}

// ── El ritmo del ensayo ───────────────────────────────────────────────────────
// A PROPÓSITO no es el de WhatsApp. Allá el bot espera 25 s a que la persona
// termine de escribir todos sus mensajes (handler.ts, REPLY_DEBOUNCE_MS); aquí
// se escribe un mensaje suelto para probar y nadie va a esperar medio minuto
// para ver si contesta. ~5 s: lo justo para que no parezca una máquina.
function numEnv(name: string, def: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) ? v : def;
}

export function demoraEnsayoMs(aleatorio = Math.random()): number {
  const espera = numEnv("ENSAYO_DEBOUNCE_MS", 3000);
  const min = numEnv("ENSAYO_DELAY_MIN", 1000);
  const max = numEnv("ENSAYO_DELAY_MAX", 3500);
  return Math.round(espera + min + aleatorio * (max - min));
}

// ── El motor ──────────────────────────────────────────────────────────────────
type Contenido =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string }
  // Lo que el modelo piensa antes de contestar. NO se le muestra a nadie, pero viaja
  // firmado y hay que devolverlo tal cual en el historial: si se pierde, la API rechaza
  // la vuelta siguiente cuando hubo herramientas de por medio.
  | { type: "thinking"; thinking: string; signature: string }
  | { type: "redacted_thinking"; data: string };

type MensajeApi = { role: "user" | "assistant"; content: string | Contenido[] };

function herramientasParaAnthropic(audios: AudioMary[] = []) {
  const base = toolDefinitions.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
  const extra = definicionProponerAudio(audios);
  return extra ? [...base, extra] : base;
}

/**
 * El cuerpo de la petición, aparte y sin efectos: así los candados de
 * `test:razonamiento` lo miran sin gastar una llamada a la API.
 */
export function cuerpoEnsayo(system: string, messages: MensajeApi[], audios: AudioMary[] = []) {
  const razonamiento = presupuestoRazonamiento();
  return {
    model: process.env.ENSAYO_MODEL ?? "claude-haiku-4-5-20251001",
    max_tokens: MAX_TOKENS,
    // Razonamiento encendido (Lukas, 10-08-2026). Ojo: con esto Anthropic solo acepta
    // temperature 1, por eso aquí no se manda ninguna.
    ...(razonamiento > 0 ? { thinking: { type: "enabled" as const, budget_tokens: razonamiento } } : {}),
    // El prompt va en bloque y marcado como cacheable: son ~6.750 tokens que se
    // repiten en cada mensaje de la práctica y así se cobran al 10% desde la
    // segunda llamada (medido el 10-08-2026; Haiku 4.5 exige 4.096 como mínimo).
    system: [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }],
    tools: herramientasParaAnthropic(audios),
    messages,
  };
}

async function pedirAnthropic(system: string, messages: MensajeApi[], apiKey: string, audios: AudioMary[] = []) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(cuerpoEnsayo(system, messages, audios)),
  });
  if (!res.ok) throw new Error(`La IA respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    content: Contenido[];
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  usoEnsayo.llamadas++;
  usoEnsayo.entrada += data.usage?.input_tokens ?? 0;
  usoEnsayo.salida += data.usage?.output_tokens ?? 0;
  return data;
}

/**
 * Responde un turno del ensayo. `turnos` es la conversación completa hasta ahora,
 * incluyendo el último mensaje del apoderado.
 */
export async function responderEnsayo(
  turnos: TurnoEnsayo[],
  audios: AudioMary[] = []
): Promise<RespuestaEnsayo> {
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
    const data = await pedirAnthropic(system, messages, apiKey, audios);

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
      const { aviso, resultado } = simularHerramienta(uso.name, uso.input ?? {}, audios);
      acciones.push(aviso);
      resultados.push({ type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(resultado) });
    }
    messages.push({ role: "user", content: resultados });
  }

  return { texto, acciones, demoraMs: demoraEnsayoMs() };
}
