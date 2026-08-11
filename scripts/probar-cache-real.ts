// ¿La caché del prompt funciona DE VERDAD? (10-08-2026)
//
// Los otros tests comprueban cómo se arma la petición; esto comprueba lo único que
// importa al final: que el proveedor la acepte y que la segunda llamada cobre lo
// cacheado al 10%. Una batería verde no sustituye a probarlo de verdad.
//
// Va por el camino de la PRÁCTICA de Mary (Anthropic directo), que es el que tiene
// clave en local. El bot en producción habla por OpenRouter con el mismo modelo y el
// mismo `cache_control`; esa clave vive allá, así que ese camino se confirma con el
// primer mensaje real después del deploy.
//
// GASTA: dos llamadas reales de Haiku 4.5 con el prompt de Mary (~6.750 tokens de
// entrada cada una). Del orden de 2 centavos de dólar.
//
// Correr con: npm run probar:cache-real
import "./env-loader.js";
import { cuerpoEnsayo } from "../src/lib/ensayo.js";
import { buildSystemPrompt } from "../src/lib/system-prompt.js";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey?.trim()) { console.error("Falta ANTHROPIC_API_KEY en .env.local"); process.exit(1); }

const sysprompt = buildSystemPrompt();

interface Uso {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

async function llamar(n: number): Promise<Uso> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      ...cuerpoEnsayo(sysprompt, [{ role: "user", content: "hola" }]),
      max_tokens: 20,
    }),
  });
  if (!res.ok) {
    console.error(`\n   ❌ La IA respondió ${res.status}: ${(await res.text()).slice(0, 300)}\n`);
    process.exit(1);
  }
  const data = (await res.json()) as { usage?: Uso };
  const u = data.usage ?? {};
  console.log(
    `   Llamada ${n}: entrada nueva ${u.input_tokens} · guardado en caché ${u.cache_creation_input_tokens ?? 0} · leído de caché ${u.cache_read_input_tokens ?? 0}`
  );
  return u;
}

console.log(`\n🔌 Probando la caché de verdad contra Anthropic (Haiku 4.5)\n`);
console.log("   Ojo: esto gasta ~2 centavos de dólar.\n");

const a = await llamar(1);
await new Promise((r) => setTimeout(r, 1500)); // que alcance a quedar guardada
const b = await llamar(2);

const leidos = b.cache_read_input_tokens ?? 0;
console.log("");
if (leidos > 0) {
  const ahorro = (leidos * 0.9) / 1_000_000; // Haiku 4.5: 1 USD por millón de entrada
  console.log(`   ✅ FUNCIONA: la segunda llamada reusó ${leidos.toLocaleString("es-CL")} tokens cacheados.`);
  console.log(`   Eso es ~${ahorro.toFixed(5)} USD menos por cada mensaje.`);
  console.log(`   En una conversación de 16 mensajes: ~${(ahorro * 15).toFixed(4)} USD menos.\n`);
  process.exit(0);
} else {
  console.log(`   ❌ NO acertó la caché (leídos 0). La aceptó pero no la reusó.`);
  console.log(`   Primera: ${JSON.stringify(a)}`);
  console.log(`   Segunda: ${JSON.stringify(b)}\n`);
  process.exit(1);
}
