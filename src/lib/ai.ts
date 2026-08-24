import OpenAI from "openai";
import type { Message } from "./db.js";
import { toolDefinitions, executeTool } from "./tools/index.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { computeState } from "./state-manager.js";
import { logCostoIA } from "./db.js";
import { todaySantiago } from "./fechas.js";
import { saludoDeEntrada } from "./mensajes.js";
import {
  elegirIA,
  razonamientoDe,
  PRESUPUESTO_RAZONAMIENTO,
  TOKENS_SIN_RAZONAR,
} from "./ia-proveedor";

const MAX_TURNS  = 12;
/**
 * El razonamiento va ENCENDIDO (Lukas, 19-08-2026: *"quiero activar la IA … con el mismo
 * modelo de razonamiento que ocupa la app de conejeros"*). Estuvo apagado del 10 al 19-08 para
 * gastar menos tokens; el interruptor de marcha atrás sigue puesto por si el gasto se dispara:
 * `RAZONAMIENTO_ENSAYO=0` lo apaga en el bot Y en la práctica de Mary a la vez (si se separaran,
 * ella ensayaría con un bot que no es el que atiende).
 *
 * Solo piensa por el camino de Anthropic: OpenRouter es la salida de emergencia y pedirle algo
 * que puede rechazar dejaría al bot mudo justo cuando es lo único que queda.
 */
export function presupuestoRazonamientoBot(): number {
  const v = parseInt(process.env.RAZONAMIENTO_ENSAYO ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : PRESUPUESTO_RAZONAMIENTO;
}

// Tarifas y estimarUSD viven en tarifas-ia.ts (sin imports .js) para que ensayo.ts,
// que sí lo pilla el build de Next, pueda usarlas sin arrastrar todo ai.ts.
export { tarifaPorModelo, estimarUSD } from "./tarifas-ia.js";
import { estimarUSD } from "./tarifas-ia.js";

let _client: OpenAI | null = null;
// Se apaga solo si el proveedor rechaza el razonamiento, y queda apagado para no repetir el
// error en cada mensaje. Vuelve a encenderse al reiniciar el bot.
let _razonando = true;
// Igual que arriba, pero para la caché del prompt: si el proveedor la rechaza, se
// apaga hasta el próximo reinicio en vez de dejar al bot sin contestar.
// Marcha atrás sin tocar código: CACHE_PROMPT=0 en el entorno la deja apagada. Existe
// porque guardar en caché cuesta un 25% más: si en producción los mensajes llegan tan
// espaciados que expira antes de reusarse, saldría más caro y hay que poder apagarla.
let _cacheando = process.env.CACHE_PROMPT !== "0";

// Con qué clave y contra qué modelo habla el bot. Lo decide `elegirIA`: Anthropic directo si
// la clave está puesta (es el único camino que acepta el razonamiento; en Arteluk esa clave ya
// vive en el servidor porque es la que lee las fotos), OpenRouter si no.
let _model = "";
let _proveedor = "";

/** El proveedor y el modelo ya resueltos, sin crear el cliente (lo miran los candados). */
function iaActual(proveedorForzado?: string): { model: string; proveedor: string } {
  if (!_proveedor) {
    const ia = elegirIA(process.env as Record<string, string | undefined>);
    if (ia.ok) { _model = ia.model; _proveedor = ia.proveedor; }
  }
  const proveedor = proveedorForzado ?? _proveedor;
  const model = _model || (proveedor === "anthropic" ? "claude-haiku-4-5" : "anthropic/claude-haiku-4-5");
  return { model, proveedor };
}

function getClient(): OpenAI {
  if (_client) return _client;
  const ia = elegirIA(process.env as Record<string, string | undefined>);
  if (!ia.ok) throw new Error(ia.motivo);

  _model = ia.model;
  _proveedor = ia.proveedor;
  console.log(`[ia] ${ia.motivo}`);
  _client = new OpenAI({
    apiKey: ia.apiKey,
    baseURL: ia.baseURL,
    defaultHeaders:
      ia.proveedor === "anthropic"
        ? { "anthropic-version": "2023-06-01" }
        : {
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
 * sin gastar una llamada. `thinking` no está en los tipos del SDK de OpenAI: viaja por la
 * capa compatible de Anthropic, que sí lo aplica (medido en la app de Conejeros).
 *
 * `max_tokens` es el TOTAL e incluye lo pensado; por eso sube al doble cuando el bot razona.
 * Con un techo por debajo del presupuesto, la petición se cae entera y la persona ve el bot mudo.
 */
export function cuerpoBot(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  razonando = true,
  proveedorForzado?: string
) {
  const { model, proveedor } = iaActual(proveedorForzado);
  const r = razonando
    ? razonamientoDe(proveedor, presupuestoRazonamientoBot())
    : { max_tokens: TOKENS_SIN_RAZONAR };
  return {
    model,
    max_tokens: r.max_tokens,
    tools: buildTools(),
    tool_choice: "auto" as const,
    ...(r.thinking ? { thinking: r.thinking } : {}),
    messages,
  };
}

/**
 * El prompt del sistema partido en dos: lo ESTABLE (que se manda idéntico en cada
 * mensaje y por eso se puede cachear) y el ESTADO DEL TURNO, que cambia cada vez.
 *
 * El orden no es un detalle: la caché es un "prefijo idéntico", así que cualquier
 * cosa que cambie tiene que ir DESPUÉS de lo cacheado. Si el estado se pegara al
 * prompt como antes, la caché no acertaría nunca y encima se pagaría el recargo de
 * escribirla en cada llamada.
 *
 * Medido el 10-08-2026: el prompt son 6.754 tokens y Haiku 4.5 exige 4.096 para
 * poder cachear, así que entra. Leer lo cacheado cuesta el 10%.
 */
export function mensajesDeSistema(
  sysprompt: string,
  estadoContext: string,
  cacheando = true
): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (!cacheando) {
    return [{ role: "system", content: sysprompt + "\n\n" + estadoContext }];
  }
  // `cache_control` es de Anthropic (vía OpenRouter) y no está en los tipos del SDK
  // de OpenAI, igual que `reasoning` en cuerpoBot.
  const bloques = [
    { type: "text", text: sysprompt, cache_control: { type: "ephemeral" } },
    { type: "text", text: estadoContext },
  ];
  return [{ role: "system", content: bloques } as unknown as OpenAI.Chat.ChatCompletionMessageParam];
}

/**
 * ¿El error viene de que el proveedor no quiso la caché? Mismo criterio que con el
 * razonamiento: ante un rechazo del parámetro se reintenta SIN caché, porque un bot
 * que gasta de más es un problema y un bot MUDO delante de una apoderada es perder
 * al cliente. Un 401, un 429 o quedarse sin saldo NO entran acá: esos hay que verlos.
 */
export function esErrorDeCache(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (/401|402|403|429|credit|balance/.test(msg)) return false;
  return /cache_control|content block|content_block/.test(msg);
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

// Por qué un chat se quedó sin respuesta. Hasta ahora todas las rutas dejaban la misma
// huella (nada) y el motivo se perdía con el siguiente deploy: Medifis #50.
export type MotivoMudo =
  | "sin_texto_del_modelo"   // el modelo devolvió vacío incluso tras el empujón
  | "silencio_deliberado"    // llamó a silenciar(): no es cliente del taller
  | "sin_mensaje_del_usuario"; // no había nada que contestar (mensaje propio o vacío)

export interface RespuestaBot {
  texto: string;
  motivo: MotivoMudo | null;
}

// El empujón del reintento (Medifis #51). Reintentar tal cual NO sirve: el bot corre a
// temperatura baja y sale el mismo vacío. Lo que cambia el resultado es decirle que ese
// silencio no corresponde.
const EMPUJON_REINTENTO =
  "Tu respuesta anterior salió vacía y la persona se quedó sin nada. " +
  "Responde ahora con un mensaje normal para ella. Si dudabas si contestar o no, contesta.";

export async function generateReply(input: {
  history: Message[];
  conversationId: number;
  phone?: string;
  prueba?: boolean;
}): Promise<string> {
  return (await generateReplyDetallado(input)).texto;
}

export async function generateReplyDetallado(input: {
  history: Message[];
  conversationId: number;
  phone?: string;
  // `true` para los npm run test:* que llaman a la IA de verdad: separa su gasto del
  // tráfico real de WhatsApp (ver logCostoIA). Por defecto es tráfico real.
  prueba?: boolean;
}): Promise<RespuestaBot> {
  // Primer contacto: el saludo que Mary escribió en "Entrenar IA" sale TAL CUAL, sin pasar por el
  // modelo — es la única forma de que salga palabra por palabra (ver mensajes.ts, 24-08-2026).
  // Si además preguntaron algo en ese mismo primer contacto, la IA contesta ESO a continuación,
  // con la orden de no volver a saludar.
  const entrada = saludoDeEntrada(input.history);
  if (entrada.texto && !entrada.ademasResponder) {
    console.log(`[BOT conv=${input.conversationId}] 👋 saludo del panel tal cual (sin llamar a la IA)`);
    return { texto: entrada.texto, motivo: null };
  }
  if (entrada.texto) {
    console.log(`[BOT conv=${input.conversationId}] 👋 saludo del panel + la IA contesta lo que preguntaron`);
    const resto = await responderConElModelo({ ...input, yaSaludado: entrada.texto });
    const cola = resto.texto.trim();
    return { texto: cola ? `${entrada.texto}\n\n${cola}` : entrada.texto, motivo: null };
  }

  return responderConElModelo(input);
}

// El camino normal: todo lo que contesta el modelo. `yaSaludado` viene con el texto del saludo
// que ya se mandó delante, para que no vuelva a presentarse encima.
async function responderConElModelo(input: {
  history: Message[];
  conversationId: number;
  phone?: string;
  prueba?: boolean;
  yaSaludado?: string;
}): Promise<RespuestaBot> {
  const client   = getClient();
  const sysprompt = buildSystemPrompt();
  const messages  = normalizeHistory(input.history);

  const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const turnoState  = computeState(String(lastUserMsg), input.history);
  const metaStr     = Object.keys(turnoState.estadoMeta).length
    ? " META:" + JSON.stringify(turnoState.estadoMeta)
    : "";
  const yaSaludo = input.yaSaludado
    ? ` [YA_SALUDASTE: acabas de mandar este saludo, va delante de lo que escribas: "${input.yaSaludado}". NO te vuelvas a presentar ni a saludar: contesta solo lo que te preguntaron.]`
    : "";
  const estadoContext = `[ESTADO_TURNO: ${turnoState.estado}${metaStr}]${yaSaludo}`;

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { texto: "", motivo: "sin_mensaje_del_usuario" };
  }

  const systemMessages = mensajesDeSistema(sysprompt, estadoContext, _cacheando);

  const ctxModelo = { ...input, sysprompt, estadoContext };
  const primero = await conversarConElModelo(client, [...systemMessages, ...messages], ctxModelo);
  if (primero.texto.trim()) return { texto: primero.texto, motivo: null };
  if (primero.silencio) return { texto: "", motivo: "silencio_deliberado" };

  // Salió vacío sin querer callar: se reintenta UNA vez con el empujón (Medifis #51).
  // Solo si el primer intento no ejecutó ninguna herramienta: si ya derivó o marcó
  // interés, repetir la vuelta las ejecutaría dos veces.
  if (primero.usoHerramientas) return { texto: "", motivo: "sin_texto_del_modelo" };

  console.warn("[ia] respuesta vacía — se reintenta una vez con el empujón");
  const segundo = await conversarConElModelo(
    client,
    [...systemMessages, ...messages, { role: "system", content: EMPUJON_REINTENTO }],
    ctxModelo
  );
  if (segundo.texto.trim()) return { texto: segundo.texto, motivo: null };
  if (segundo.silencio) return { texto: "", motivo: "silencio_deliberado" };
  return { texto: "", motivo: "sin_texto_del_modelo" };
}

// Una vuelta completa con el modelo: pide, ejecuta las herramientas que pida y vuelve a
// pedir hasta que conteste. Devuelve el texto (vacío si no escribió nada), si el silencio
// fue deliberado —llamó a silenciar()— y si llegó a ejecutar alguna herramienta.
async function conversarConElModelo(
  client: OpenAI,
  threadInicial: OpenAI.Chat.ChatCompletionMessageParam[],
  input: { conversationId: number; phone?: string; sysprompt: string; estadoContext: string; prueba?: boolean }
): Promise<{ texto: string; silencio: boolean; usoHerramientas: boolean }> {
  const { sysprompt, estadoContext } = input;
  let turns = 0;
  let silencio = false;
  let usoHerramientas = false;
  const thread = [...threadInicial];

  while (turns < MAX_TURNS) {
    const pedir = (razonando: boolean) =>
      client.chat.completions.create(
        cuerpoBot(thread as OpenAI.Chat.ChatCompletionMessageParam[], razonando) as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      );

    let response;
    try {
      response = await pedir(_razonando);
    } catch (e) {
      // Primero la caché: si el proveedor no quiere `cache_control`, se sigue sin
      // ella (se gasta más, pero el bot contesta). Queda apagada hasta reiniciar.
      if (_cacheando && esErrorDeCache(e)) {
        console.warn(`[ia] el proveedor rechazó la caché del prompt, se sigue sin ella: ${String(e).slice(0, 120)}`);
        _cacheando = false;
        thread[0] = mensajesDeSistema(sysprompt, estadoContext, false)[0];
        response = await pedir(_razonando);
      } else if (!_razonando || !esErrorDeRazonamiento(e)) {
        throw e;
      } else {
        // Una sola vez por proceso: si el proveedor no quiere el razonamiento, se sigue
        // contestando sin él en vez de dejar a la persona esperando.
        console.warn(`[ia] el proveedor rechazó el razonamiento, se sigue sin él: ${String(e).slice(0, 120)}`);
        _razonando = false;
        response = await pedir(false);
      }
    }

    // Queda anotado cuánto se leyó de caché y cuánto se guardó. Es lo único que
    // dirá, con la base de producción delante, si la caché está ahorrando de verdad
    // o si las apoderadas escriben tan espaciado que expira antes de reusarse.
    const uso = response.usage as unknown as {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
    } | undefined;
    if (uso) {
      console.info(
        `[ia] entrada ${uso.prompt_tokens ?? 0} · leído de caché ${uso.prompt_tokens_details?.cached_tokens ?? 0} · guardado ${uso.prompt_tokens_details?.cache_write_tokens ?? 0}`
      );
      // Contabilidad de gasto (13-08-2026), igual que Medifis/Anpalex/Conejeros. El
      // estimado no descuenta la caché (OpenRouter no la desglosa en el precio), así
      // que puede quedar algo caro de más — mejor eso que esconder gasto real.
      try {
        const usd = estimarUSD(iaActual().model, uso.prompt_tokens ?? 0, uso.completion_tokens ?? 0);
        logCostoIA(usd, {
          conversationId: input.conversationId,
          prueba: !!input.prueba,
          dia: todaySantiago(),
        });
      } catch (e) { console.error("gasto IA: no pude registrar el costo:", e); }
    }

    const choice = response.choices[0];

    if (choice.finish_reason === "stop") {
      return { texto: choice.message.content ?? "", silencio, usoHerramientas };
    }

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
      thread.push({ role: "assistant", content: choice.message.content ?? null, tool_calls: choice.message.tool_calls });

      const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.function.arguments); } catch { /* empty args */ }

        const result = await executeTool(
          toolCall.function.name,
          args,
          { conversationId: input.conversationId, phone: input.phone }
        );
        usoHerramientas = true;
        // Callarse solo cuenta si la tool lo aceptó: a un lead de anuncio se le niega
        // (ver tools/silenciar.ts), y ahí el silencio NO es deliberado, es un fallo.
        if (toolCall.function.name === "silenciar" && (result as { ok?: boolean })?.ok !== false) {
          silencio = true;
        }

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
    if (choice.message.content) return { texto: choice.message.content, silencio, usoHerramientas };
    break;
  }

  // Se acabaron los turnos sin una respuesta: si el silencio era a propósito se
  // respeta, y si no, no se deja a nadie esperando.
  if (silencio) return { texto: "", silencio, usoHerramientas };
  return { texto: "Déjame un momento, vuelvo contigo enseguida.", silencio, usoHerramientas };
}
