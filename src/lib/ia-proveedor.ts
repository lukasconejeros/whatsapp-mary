// CON QUÉ CLAVE PIENSA EL BOT DE MARY, Y SI PIENSA ANTES DE CONTESTAR.
//
// Encargo de Lukas (19-08-2026): *"quiero activar la IA a las personas que hablen en meta con
// el mismo modelo de razonamiento que ocupa la app de conejeros"*. En Conejeros el bot habla
// DIRECTO con Anthropic, que es el único camino que acepta `thinking`; OpenRouter queda como
// salida de emergencia. Acá hasta hoy solo existía OpenRouter y el razonamiento estaba en cero
// (se apagó el 10-08 para gastar menos tokens).
//
// Por qué importa tener las dos puertas: la cuenta de OpenRouter ya se quedó sin saldo una vez
// (402) y en EasyPanel llegó a estar puesto el texto de ejemplo como clave — no es una clave,
// pero tampoco está vacío, así que el bot la daba por buena y se estrellaba con un 401 en cada
// mensaje. La clave de Anthropic ya vive en el servidor de Arteluk: es la que lee las fotos.
//
// Lógica pura (el entorno entra por parámetro) para poder probar las combinaciones sin tener
// ninguna clave delante. Sin extensión `.js` en los imports: este módulo lo comparten la API de
// Next y los scripts de tsx (mismo motivo que en `secciones-negocio.ts`).

export interface EleccionIA {
  ok: boolean;
  /** "anthropic" | "openrouter" */
  proveedor: string;
  baseURL: string;
  apiKey: string;
  model: string;
  /** Por qué se eligió (o por qué no hay ninguna): se muestra en los logs del bot. */
  motivo: string;
}

export const URL_ANTHROPIC = "https://api.anthropic.com/v1";
export const URL_OPENROUTER = "https://openrouter.ai/api/v1";

/** Una clave de verdad, no el texto de ejemplo que quedó puesto en EasyPanel. */
export function claveUsable(valor: string | undefined, prefijo: string): boolean {
  const v = (valor ?? "").trim();
  return v.startsWith(prefijo) && v.length > 20;
}

/**
 * Anthropic nombra sus modelos sin el "anthropic/" que le pone OpenRouter. Con el prefijo
 * puesto responde 404 "model not found", que es de los errores que más caro cuestan porque
 * parece un problema de la clave.
 */
export function modeloParaAnthropic(model: string): string {
  return model.replace(/^anthropic\//, "");
}

/** Lo que cabe en una respuesta cuando el bot NO piensa antes de contestar. */
export const TOKENS_SIN_RAZONAR = 2048;
/** Lo que puede gastar pensando. Anthropic exige mínimo 1024 y menos que max_tokens. */
export const PRESUPUESTO_RAZONAMIENTO = 2048;
/** Pensar y responder salen del MISMO presupuesto: por eso el techo sube al doble. */
export const TOKENS_RAZONANDO = PRESUPUESTO_RAZONAMIENTO + TOKENS_SIN_RAZONAR;

export interface OpcionesRazonamiento {
  max_tokens: number;
  thinking?: { type: "enabled"; budget_tokens: number };
}

/**
 * Si el bot piensa antes de contestar, y cuánto.
 *
 * **Solo con Anthropic.** OpenRouter no acepta este campo por la capa compatible y es el
 * camino de emergencia cuando la clave de Anthropic falla: pedírselo dejaría al bot mudo
 * justo en el momento en que es lo único que queda.
 *
 * Ojo con `max_tokens`: es el TOTAL e incluye lo pensado. Si no supera al presupuesto, la
 * petición se cae entera y la persona ve el bot mudo (pasó el 10-08 con el ensayo de Mary).
 */
export function razonamientoDe(
  proveedor: string,
  presupuesto: number = PRESUPUESTO_RAZONAMIENTO
): OpcionesRazonamiento {
  if (proveedor !== "anthropic" || presupuesto <= 0) return { max_tokens: TOKENS_SIN_RAZONAR };
  return {
    max_tokens: presupuesto + TOKENS_SIN_RAZONAR,
    thinking: { type: "enabled", budget_tokens: presupuesto },
  };
}

/**
 * Con qué clave habla el bot: Anthropic directo si está puesta (razona), OpenRouter si no.
 */
export function elegirIA(env: Record<string, string | undefined>): EleccionIA {
  const anthropic = (env.ANTHROPIC_API_KEY ?? "").trim();
  const openrouter = (env.OPENROUTER_API_KEY ?? "").trim();

  if (claveUsable(anthropic, "sk-ant")) {
    const model = modeloParaAnthropic(
      (env.ANTHROPIC_MODEL ?? env.OPENROUTER_MODEL ?? "claude-haiku-4-5").trim()
    );
    return {
      ok: true,
      proveedor: "anthropic",
      baseURL: URL_ANTHROPIC,
      apiKey: anthropic,
      model,
      motivo: `hablando directo con Anthropic (${model})`,
    };
  }

  if (claveUsable(openrouter, "sk-or")) {
    const model = (env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5").trim();
    return {
      ok: true,
      proveedor: "openrouter",
      baseURL: URL_OPENROUTER,
      apiKey: openrouter,
      model,
      motivo: `hablando por OpenRouter (${model})`,
    };
  }

  // Ni una ni otra: se dice CUÁL falta y por qué, en vez de "falta la API key". Nunca se
  // escribe la clave entera en el mensaje, que termina en los logs.
  const pistas: string[] = [];
  if (!anthropic) pistas.push("ANTHROPIC_API_KEY está vacía");
  else if (!claveUsable(anthropic, "sk-ant")) pistas.push(`ANTHROPIC_API_KEY no parece una clave ("${anthropic.slice(0, 12)}…")`);
  if (!openrouter) pistas.push("OPENROUTER_API_KEY está vacía");
  else if (!claveUsable(openrouter, "sk-or")) pistas.push(`OPENROUTER_API_KEY no parece una clave ("${openrouter.slice(0, 12)}…")`);

  return {
    ok: false,
    proveedor: "",
    baseURL: "",
    apiKey: "",
    model: "",
    motivo: `el bot no tiene con qué pensar: ${pistas.join(" y ")}`,
  };
}
