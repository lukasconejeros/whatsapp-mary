// CON QUÉ CLAVE PIENSA EL BOT DE MARY, Y SI PIENSA ANTES DE CONTESTAR.
//
// Escrito el 19-08-2026 con el encargo de Lukas: "quiero activar la IA con el mismo modelo
// de razonamiento que ocupa la app de conejeros". Allá el bot habla DIRECTO con Anthropic
// (que es el único camino que acepta `thinking`) y deja OpenRouter como salida de emergencia.
// Acá hasta hoy solo existía OpenRouter y el razonamiento estaba en cero.
//
// Lógica pura: entra el entorno por parámetro, así que estas 14 comprobaciones no gastan
// ni una llamada a la IA.
import {
  elegirIA,
  claveUsable,
  modeloParaAnthropic,
  razonamientoDe,
  URL_ANTHROPIC,
  URL_OPENROUTER,
  PRESUPUESTO_RAZONAMIENTO,
  TOKENS_RAZONANDO,
  TOKENS_SIN_RAZONAR,
} from "../src/lib/ia-proveedor";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST con qué clave piensa el bot de Mary (y si razona)\n");

const ANTHROPIC = "sk-ant-api03-" + "x".repeat(40);
const OPENROUTER = "sk-or-v1-" + "y".repeat(40);
const EJEMPLO = "PEGA-LA-DE-TU-EASYPANEL-DE-WALY"; // el texto que quedó puesto de verdad en EasyPanel

// 1) Con la clave de Anthropic puesta, va directo a Anthropic (es el camino que razona).
const a = elegirIA({ ANTHROPIC_API_KEY: ANTHROPIC, OPENROUTER_MODEL: "anthropic/claude-haiku-4-5" });
check("con clave de Anthropic, habla directo con Anthropic", a.ok && a.proveedor === "anthropic", JSON.stringify(a.motivo));
check("y le quita el 'anthropic/' al nombre del modelo", a.model === "claude-haiku-4-5", a.model);
check("apuntando a la URL de Anthropic", a.baseURL === URL_ANTHROPIC, a.baseURL);

// 2) El texto de ejemplo NO es una clave: no puede ganarle a la buena ni pasar por válido.
const b = elegirIA({ ANTHROPIC_API_KEY: ANTHROPIC, OPENROUTER_API_KEY: EJEMPLO });
check("el texto de ejemplo de OpenRouter no se usa nunca", b.proveedor === "anthropic", JSON.stringify(b));

const c = elegirIA({ OPENROUTER_API_KEY: EJEMPLO });
check("y solo con ese texto, el bot dice que no tiene con qué pensar", !c.ok, JSON.stringify(c));
check("diciendo cuál es la clave mala", /OPENROUTER_API_KEY no parece una clave/.test(c.motivo), c.motivo);
check("sin filtrar la clave entera en el mensaje", !c.motivo.includes(EJEMPLO), c.motivo);

// 3) Sin Anthropic pero con OpenRouter de verdad, sigue funcionando como hasta hoy.
const d = elegirIA({ OPENROUTER_API_KEY: OPENROUTER, OPENROUTER_MODEL: "anthropic/claude-haiku-4-5" });
check("sin Anthropic, usa OpenRouter", d.ok && d.proveedor === "openrouter", JSON.stringify(d));
check("y ahí el modelo SÍ lleva el 'anthropic/'", d.model === "anthropic/claude-haiku-4-5", d.model);
check("apuntando a la URL de OpenRouter", d.baseURL === URL_OPENROUTER, d.baseURL);

// 4) Sin ninguna clave: no revienta, explica.
const e = elegirIA({});
check("sin ninguna clave no revienta, avisa", !e.ok && /no tiene con qué pensar/.test(e.motivo), e.motivo);

// 5) El razonamiento: encendido con Anthropic, apagado en el camino de emergencia.
const rA = razonamientoDe("anthropic");
check("con Anthropic el bot piensa antes de contestar", rA.thinking?.type === "enabled", JSON.stringify(rA));
check("con el presupuesto que Anthropic exige (≥1024)", (rA.thinking?.budget_tokens ?? 0) >= 1024, JSON.stringify(rA));
check("y el techo total deja sitio para pensar Y responder", rA.max_tokens > PRESUPUESTO_RAZONAMIENTO && rA.max_tokens === TOKENS_RAZONANDO, JSON.stringify(rA));

const rO = razonamientoDe("openrouter");
check("por OpenRouter NO se pide pensar (rechazarlo dejaría al bot mudo)", !rO.thinking, JSON.stringify(rO));
check("y ahí el techo es el de siempre", rO.max_tokens === TOKENS_SIN_RAZONAR, JSON.stringify(rO));

// 6) Detalles de las dos funciones sueltas.
check("una clave corta no pasa por buena", !claveUsable("sk-ant-123", "sk-ant"));
check("el modelo sin prefijo se deja igual", modeloParaAnthropic("claude-haiku-4-5") === "claude-haiku-4-5");

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
