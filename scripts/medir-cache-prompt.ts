// ¿Cuánto se ahorraría con la CACHÉ DE PROMPT? (10-08-2026)
//
// El hallazgo que la motiva: en una conversación de 16 mensajes van ~166.000
// tokens de ENTRADA contra ~1.800 de salida. Casi todo es el mismo prompt del
// sistema repetido en cada llamada. Anthropic cobra la entrada CACHEADA al 10%.
//
// Esto solo MIDE, no cambia nada:
//   1. cuenta los tokens del prompt del sistema (gratis, no gasta),
//   2. avisa si llega al mínimo que exige el modelo para poder cachear.
//
// Correr con: npm run medir:cache
import "./env-loader.js";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../src/lib/system-prompt.js";

/** Mínimo de tokens que Anthropic exige para cachear, por familia de modelo. */
const MINIMO: Record<string, number> = {
  "claude-haiku-4-5": 4096,
  "claude-sonnet-4-5": 1024,
  "claude-opus-4-5": 4096,
};

const MODELO = process.env.MODELO_MEDICION ?? "claude-haiku-4-5";

const key = process.env.ANTHROPIC_API_KEY;
if (!key?.trim()) {
  console.error("Falta ANTHROPIC_API_KEY en .env.local (solo se usa para contar, no gasta).");
  process.exit(1);
}

const client = new Anthropic({ apiKey: key });
const sysprompt = buildSystemPrompt();

const r = await client.messages.countTokens({
  model: MODELO,
  system: sysprompt,
  messages: [{ role: "user", content: "hola" }],
});

const minimo = MINIMO[MODELO] ?? 1024;
const tokens = r.input_tokens;

console.log(`\n🧮 Prompt del sistema de Mary, medido contra ${MODELO}\n`);
console.log(`   Caracteres: ${sysprompt.length.toLocaleString("es-CL")}`);
console.log(`   Tokens:     ${tokens.toLocaleString("es-CL")}`);
console.log(`   Mínimo para cachear: ${minimo.toLocaleString("es-CL")}\n`);

if (tokens >= minimo) {
  // Precios Haiku 4.5: 1 USD/millón de entrada · lectura cacheada al 10% · escritura 1,25x.
  const porLlamada = tokens / 1_000_000;
  console.log(`   ✅ SÍ se puede cachear (sobra ${(tokens - minimo).toLocaleString("es-CL")}).`);
  console.log(`   Hoy cada llamada paga ${tokens.toLocaleString("es-CL")} tokens a precio lleno.`);
  console.log(`   Con caché, la 2ª y siguientes pagan el 10%: ahorra ~${((porLlamada * 0.9) * 1).toFixed(5)} USD por llamada.`);
  console.log(`   En una conversación de 16 mensajes: ~${((porLlamada * 0.9) * 15).toFixed(4)} USD menos.\n`);
} else {
  console.log(`   ❌ El prompt es MÁS CORTO que el mínimo: la caché no se activaría.\n`);
}
