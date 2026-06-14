import OpenAI from "openai";
import type { Message } from "./db.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { computeState } from "./state-manager.js";

const MODEL   = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";
const MAX_TURNS  = 12;
const MAX_TOKENS = 2048;

let _client: OpenAI | null = null;

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
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: buildTools(),
      tool_choice: "auto",
      messages: thread as OpenAI.Chat.ChatCompletionMessageParam[],
    });

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
