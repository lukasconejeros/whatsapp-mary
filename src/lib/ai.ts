import OpenAI from "openai";
import type { Message } from "./db.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { computeState } from "./state-manager.js";

const MODEL   = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";
const MAX_TURNS  = 12;
// `max_tokens` es el total e incluye lo que el modelo gasta pensando, así que tiene que
// superar el presupuesto de razonamiento o la petición se cae y el bot queda mudo.
const MAX_TOKENS = 3072;
/**
 * El razonamiento va APAGADO (Lukas, 10-08-2026: "si el sin razonamiento alcanza, igual está
 * bien, la idea es que gaste pocos tokens"). Se midió antes de apagarlo, no de oído: con y sin
 * pensar, los dos arneses reales (`ensayo:cerebro` y `ensayo:arrastre`, 5 corridas) dieron los
 * MISMOS aciertos, y sin pensar contesta en la mitad de tiempo (~5,7 s → ~2,5 s por respuesta)
 * con 3,3 veces menos tokens de salida. Aquí no hay agenda que calzar ni reservas que calcular:
 * el bot informa, y para eso Haiku no necesita pensar antes.
 * Para volver a encenderlo: `RAZONAMIENTO_ENSAYO=1024` (vale para el bot y para la práctica).
 */
export function presupuestoRazonamientoBot(): number {
  const v = parseInt(process.env.RAZONAMIENTO_ENSAYO ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

let _client: OpenAI | null = null;
// Se apaga solo si el proveedor rechaza el razonamiento, y queda apagado para no repetir el
// error en cada mensaje. Vuelve a encenderse al reiniciar el bot.
let _razonando = true;

function getClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey?.trim()) throw new Error("Falta OPENROUTER_API_KEY en .env.local");
  _client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://conejeros-solutions.cl",
      "X-Title": "Orion.AI WhatsApp Bot",
    },
  });
  return _client;
}

function buildTools(): OpenAI.Chat.ChatCompletionTool[] {
  return toolDefinitions.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

/**
 * El cuerpo de la petición, aparte y sin efectos, para que `test:razonamiento` lo mire
 * sin gastar una llamada. `reasoning` es de OpenRouter (no está en los tipos del SDK de
 * OpenAI) y es lo que enciende el razonamiento de Haiku 4.5.
 */
export function cuerpoBot(messages: OpenAI.Chat.ChatCompletionMessageParam[], razonando = true) {
  const presupuesto = presupuestoRazonamientoBot();
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: buildTools(),
    tool_choice: "auto" as const,
    ...(razonando && presupuesto > 0 ? { reasoning: { max_tokens: presupuesto } } : {}),
    messages,
  };
}

/**
 * ¿El error es porque OpenRouter no quiso el razonamiento? Este camino no se puede probar
 * fuera de producción (la clave de OpenRouter vive allá), así que ante un rechazo del
 * parámetro se reintenta sin él: un bot que piensa menos es un problema, un bot MUDO
 * delante de una apoderada es perder al cliente. Un 401 o un 429 no entran acá: esos hay
 * que verlos, no taparlos con un reintento.
 */
export function esErrorDeRazonamiento(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (/401|403|429|credit|balance/.test(msg)) return false;
  return /reasoning|thinking/.test(msg);
}

function normalizeHistory(history: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = history.map((m) => ({
    role: m.role === "user" ? "user" : ("assistant" as const),
    content: m.content,
  }));

  // Drop leading assistant messages
  while (msgs.length > 0 && msgs[0].role === "assistant") msgs.shift();

  // Merge consecutive same-role messages
  const normalized: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const msg of msgs) {
    const last = normalized[normalized.length - 1];
    if (last && last.role === msg.role) {
      last.content = String(last.content) + " " + String(msg.content);
    } else {
      normalized.push(msg);
    }
  }

  return normalized;
}

export async function generateReply(input: {
  history: Message[];
  conversationId: number;
  phone?: string;
}): Promise<string> {
  const client   = getClient();
  const sysprompt = buildSystemPrompt();
  const messages  = normalizeHistory(input.history);

  const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const turnoState  = computeState(String(lastUserMsg), input.history);
  const metaStr     = Object.keys(turnoState.estadoMeta).length
    ? " META:" + JSON.stringify(turnoState.estadoMeta)
    : "";
  const estadoContext = `[ESTADO_TURNO: ${turnoState.estado}${metaStr}]`;

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return "";

  const systemMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: sysprompt + "\n\n" + estadoContext },
  ];

  let turns = 0;
  const thread = [...systemMessages, ...messages];

  while (turns < MAX_TURNS) {
    const pedir = (razonando: boolean) =>
      client.chat.completions.create(
        cuerpoBot(thread as OpenAI.Chat.ChatCompletionMessageParam[], razonando) as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      );

    let response;
    try {
      response = await pedir(_razonando);
    } catch (e) {
      if (!_razonando || !esErrorDeRazonamiento(e)) throw e;
      // Una sola vez por proceso: si el proveedor no quiere el razonamiento, se sigue
      // contestando sin él en vez de dejar a la persona esperando.
      console.warn(`[ia] el proveedor rechazó el razonamiento, se sigue sin él: ${String(e).slice(0, 120)}`);
      _razonando = false;
      response = await pedir(false);
    }

    const choice = response.choices[0];

    if (choice.finish_reason === "stop" || choice.finish_reason === "end_turn") {
      return choice.message.content ?? "";
    }

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
      thread.push({ role: "assistant", content: choice.message.content ?? null, tool_calls: choice.message.tool_calls });

      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

      for (const toolCall of choice.message.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch { /* empty args */ }

        const result = await executeTool(
          toolCall.function.name,
          args,
          { conversationId: input.conversationId, phone: input.phone }
        );

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      thread.push(...toolResults);
      turns++;
      continue;
    }

    // Respuesta de texto sin tool_calls
    if (choice.message.content) return choice.message.content;
    break;
  }

  return "Déjame un momento, vuelvo contigo enseguida.";
}
