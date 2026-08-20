/**
 * Candados del RAZONAMIENTO de Haiku 4.5.
 *
 * Va ENCENDIDO desde el 19-08-2026 (encargo de Lukas: *"quiero activar la IA … con el mismo
 * modelo de razonamiento que ocupa la app de conejeros"*). Estuvo apagado del 10 al 19-08 para
 * gastar menos tokens; el interruptor de marcha atrás sigue existiendo (`RAZONAMIENTO_ENSAYO=0`).
 *
 * Hay DOS caminos distintos hacia el mismo modelo y es fácil tocar uno y olvidar el otro:
 *   · La pantalla de práctica de Mary → Anthropic directo (`src/lib/ensayo.ts`).
 *   · El bot que contesta WhatsApp     → Anthropic directo si hay clave, OpenRouter si no
 *                                        (`src/lib/ia-proveedor.ts` decide, `src/lib/ai.ts` pide).
 * Si solo uno piensa, Mary ensaya con un bot que no es el que atiende. Estos candados miran
 * los DOS cuerpos de petición, sin gastar una sola llamada a la API.
 *
 * Dos detalles que revientan en caliente:
 *   1. Anthropic exige `max_tokens` MAYOR que el presupuesto de razonamiento; si no, la
 *      petición se cae entera y la persona ve el bot mudo.
 *   2. Por OpenRouter NO se pide pensar: es el camino de emergencia (la clave de Anthropic
 *      caída) y que lo rechacen ahí dejaría al bot mudo justo cuando es lo único que queda.
 *
 *   npx tsx scripts/test-razonamiento.ts
 */
import { cuerpoEnsayo } from "../src/lib/ensayo.js";
import { cuerpoBot, esErrorDeRazonamiento } from "../src/lib/ai.js";
import { PRESUPUESTO_RAZONAMIENTO, TOKENS_RAZONANDO, TOKENS_SIN_RAZONAR } from "../src/lib/ia-proveedor";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); pass++; }
  else { console.log(`  ❌ ${msg}`); fail++; }
}

type CuerpoEns = { model: string; max_tokens: number; thinking?: { type?: string; budget_tokens?: number }; temperature?: number };
type CuerpoBot = { model: string; max_tokens: number; thinking?: { type?: string; budget_tokens?: number }; reasoning?: { max_tokens?: number } };
const pedirEnsayo = () => cuerpoEnsayo("system de prueba", [{ role: "user", content: "hola" }]) as CuerpoEns;
const pedirBot = (proveedor = "anthropic", razonando = true) =>
  cuerpoBot([{ role: "user", content: "hola" }], razonando, proveedor) as CuerpoBot;

console.log("\n🧠 Razonamiento de Haiku 4.5 (encendido, como en la app de Conejeros)\n");

// ── Como sale hoy a producción: Anthropic directo y pensando ─────────────────
delete process.env.RAZONAMIENTO_ENSAYO;
const ens = pedirEnsayo();
const bot = pedirBot("anthropic");
console.log("Sin variable de entorno (lo que corre en producción)");
ok(/haiku-4-5/.test(ens.model), `la práctica usa Haiku 4.5 (${ens.model})`);
ok(/haiku-4-5/.test(bot.model), `el bot usa Haiku 4.5 (${bot.model})`);
ok(ens.thinking?.type === "enabled", "la práctica piensa antes de contestar");
ok(bot.thinking?.type === "enabled", "el bot de WhatsApp piensa antes de contestar");
ok(
  (ens.thinking?.budget_tokens ?? 0) === (bot.thinking?.budget_tokens ?? -1),
  "los dos razonan con el MISMO presupuesto (si no, Mary ensaya con otro bot)"
);
ok((bot.thinking?.budget_tokens ?? 0) === PRESUPUESTO_RAZONAMIENTO, `el presupuesto es el de la casa (${PRESUPUESTO_RAZONAMIENTO})`);
ok(bot.max_tokens === TOKENS_RAZONANDO, `el techo del bot deja sitio para pensar Y responder (${bot.max_tokens})`);
ok(ens.max_tokens > (ens.thinking?.budget_tokens ?? 0), `max_tokens de la práctica (${ens.max_tokens}) deja sitio a la respuesta, no solo al razonamiento`);
ok(ens.temperature === undefined || ens.temperature === 1, "no manda una temperatura que la API rechazaría");

// ── Por OpenRouter (emergencia): contesta, pero sin pedir pensar ─────────────
console.log("\nCamino de emergencia (OpenRouter, cuando la clave de Anthropic falla)");
const botOR = pedirBot("openrouter");
ok(!botOR.thinking, "por OpenRouter no se manda `thinking`");
ok(!botOR.reasoning, "ni el `reasoning` de OpenRouter: ahí lo que importa es no quedarse mudo");
ok(botOR.max_tokens === TOKENS_SIN_RAZONAR, `y el techo es el de siempre (${botOR.max_tokens})`);

// ── Marcha atrás sin tocar código, por si el gasto se dispara ────────────────
console.log("\nCon RAZONAMIENTO_ENSAYO=0 (marcha atrás)");
process.env.RAZONAMIENTO_ENSAYO = "0";
const ensOff = pedirEnsayo();
const botOff = pedirBot("anthropic");
ok(!ensOff.thinking, "la práctica deja de pensar");
ok(!botOff.thinking, "el bot deja de pensar");
ok(botOff.max_tokens === TOKENS_SIN_RAZONAR, "y el bot vuelve al techo corto");
delete process.env.RAZONAMIENTO_ENSAYO;

// ── Si el proveedor no quisiera el razonamiento, el bot NO puede quedarse mudo ──
console.log("\nRed de seguridad");
ok(esErrorDeRazonamiento(new Error('400 Unrecognized request argument supplied: reasoning')), "reconoce el rechazo del parámetro");
ok(esErrorDeRazonamiento(new Error('unsupported_value: thinking is not supported for this model')), "reconoce que el modelo no soporta pensar");
ok(!esErrorDeRazonamiento(new Error("401 No auth credentials found")), "una clave mala NO se confunde con esto");
ok(!esErrorDeRazonamiento(new Error("429 rate limited")), "un límite de uso tampoco");
const sinRazonar = pedirBot("anthropic", false);
ok(!sinRazonar.thinking, "el reintento va sin el parámetro que rechazaron");
ok(sinRazonar.max_tokens === TOKENS_SIN_RAZONAR, "y con el techo corto, que es lo que acepta el modelo sin pensar");

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
