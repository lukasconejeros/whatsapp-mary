/**
 * Candados del RAZONAMIENTO de Haiku 4.5 (pedido de Lukas el 10-08-2026: "ocupemos el
 * haiku con razonamiento para ver cómo va").
 *
 * Hay DOS caminos distintos hacia el mismo modelo y es fácil arreglar uno y olvidar el otro:
 *   · La pantalla de práctica de Mary → Anthropic directo (`src/lib/ensayo.ts`).
 *   · El bot que contesta WhatsApp     → OpenRouter (`src/lib/ai.ts`).
 * Si solo uno piensa, Mary ensaya con un bot que no es el que atiende. Estos candados miran
 * los DOS cuerpos de petición, sin gastar una sola llamada a la API.
 *
 * El detalle que revienta en caliente: Anthropic exige `max_tokens` MAYOR que el presupuesto
 * de razonamiento. Con los 1024 que había, la petición se caía y el bot quedaba mudo.
 *
 *   npx tsx scripts/test-razonamiento.ts
 */
import { cuerpoEnsayo } from "../src/lib/ensayo.js";
import { cuerpoBot, esErrorDeRazonamiento } from "../src/lib/ai.js";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); pass++; }
  else { console.log(`  ❌ ${msg}`); fail++; }
}

console.log("\n🧠 Razonamiento de Haiku 4.5\n");

// ── La pantalla de práctica (Anthropic directo) ──────────────────────────────
console.log("Pantalla de práctica de Mary (Anthropic)");
const ens = cuerpoEnsayo("system de prueba", [{ role: "user", content: "hola" }]) as {
  model: string;
  max_tokens: number;
  thinking?: { type?: string; budget_tokens?: number };
  temperature?: number;
};
ok(/haiku-4-5/.test(ens.model), `usa Haiku 4.5 (${ens.model})`);
ok(ens.thinking?.type === "enabled", "el razonamiento va encendido");
ok((ens.thinking?.budget_tokens ?? 0) >= 1024, `el presupuesto llega al mínimo de Anthropic (${ens.thinking?.budget_tokens})`);
ok(ens.max_tokens > (ens.thinking?.budget_tokens ?? 0), `max_tokens (${ens.max_tokens}) deja sitio a la respuesta, no solo al razonamiento`);
// Con razonamiento encendido, Anthropic RECHAZA cualquier temperatura distinta de 1.
ok(ens.temperature === undefined || ens.temperature === 1, "no manda una temperatura que la API rechazaría");

// ── El bot que contesta WhatsApp (OpenRouter) ────────────────────────────────
console.log("\nBot de WhatsApp (OpenRouter)");
const bot = cuerpoBot([{ role: "user", content: "hola" }]) as {
  model: string;
  max_tokens: number;
  reasoning?: { max_tokens?: number; effort?: string };
};
ok(/haiku-4-5/.test(bot.model), `usa Haiku 4.5 (${bot.model})`);
ok(!!bot.reasoning, "el razonamiento va encendido");
ok((bot.reasoning?.max_tokens ?? 0) >= 1024, `el presupuesto llega al mínimo (${bot.reasoning?.max_tokens})`);
ok(bot.max_tokens > (bot.reasoning?.max_tokens ?? 0), `max_tokens (${bot.max_tokens}) deja sitio a la respuesta`);

// ── Si OpenRouter no quisiera el razonamiento, el bot NO puede quedarse mudo ──
// El camino del bot no se puede probar desde el computador de Lukas (la clave de OpenRouter
// solo está en producción). Así que ante un rechazo del parámetro se reintenta sin él: un bot
// que piensa menos es un problema; un bot mudo delante de una apoderada es perder al cliente.
console.log("\nRed de seguridad");
ok(esErrorDeRazonamiento(new Error('400 Unrecognized request argument supplied: reasoning')), "reconoce el rechazo del parámetro");
ok(esErrorDeRazonamiento(new Error('unsupported_value: thinking is not supported for this model')), "reconoce que el modelo no soporta pensar");
ok(!esErrorDeRazonamiento(new Error("401 No auth credentials found")), "una clave mala NO se confunde con esto");
ok(!esErrorDeRazonamiento(new Error("429 rate limited")), "un límite de uso tampoco");
const sinRazonar = cuerpoBot([{ role: "user", content: "hola" }], false) as { reasoning?: unknown };
ok(!sinRazonar.reasoning, "el reintento va sin el parámetro que rechazaron");

// ── Los dos tienen que pensar lo mismo ───────────────────────────────────────
console.log("\nLos dos caminos");
ok(
  (ens.thinking?.budget_tokens ?? 0) === (bot.reasoning?.max_tokens ?? -1),
  "la práctica y el bot razonan con el mismo presupuesto (si no, Mary ensaya con otro bot)"
);

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
