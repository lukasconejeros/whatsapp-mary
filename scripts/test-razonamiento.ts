/**
 * Candados del RAZONAMIENTO de Haiku 4.5.
 *
 * Va APAGADO (Lukas, 10-08-2026: "si el sin razonamiento alcanza, igual está bien, la idea es
 * que gaste pocos tokens"). No se apagó de oído: con y sin pensar, `ensayo:cerebro` y
 * `ensayo:arrastre` dieron los mismos aciertos en 5 corridas, y sin pensar el bot contesta en
 * la mitad de tiempo con 3,3 veces menos tokens de salida. Este bot informa; no calza agendas.
 *
 * Hay DOS caminos distintos hacia el mismo modelo y es fácil tocar uno y olvidar el otro:
 *   · La pantalla de práctica de Mary → Anthropic directo (`src/lib/ensayo.ts`).
 *   · El bot que contesta WhatsApp     → OpenRouter (`src/lib/ai.ts`).
 * Si solo uno piensa, Mary ensaya con un bot que no es el que atiende. Estos candados miran
 * los DOS cuerpos de petición, sin gastar una sola llamada a la API.
 *
 * El detalle que revienta en caliente si se vuelve a encender: Anthropic exige `max_tokens`
 * MAYOR que el presupuesto de razonamiento. Con los 1024 que había, la petición se caía y el
 * bot quedaba mudo.
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

type CuerpoEns = { model: string; max_tokens: number; thinking?: { type?: string; budget_tokens?: number }; temperature?: number };
type CuerpoBot = { model: string; max_tokens: number; reasoning?: { max_tokens?: number } };
const pedirEnsayo = () => cuerpoEnsayo("system de prueba", [{ role: "user", content: "hola" }]) as CuerpoEns;
const pedirBot = () => cuerpoBot([{ role: "user", content: "hola" }]) as CuerpoBot;

console.log("\n🧠 Razonamiento de Haiku 4.5 (apagado por defecto)\n");

// ── Como sale hoy a producción: los DOS caminos sin pensar ───────────────────
delete process.env.RAZONAMIENTO_ENSAYO;
const ens = pedirEnsayo();
const bot = pedirBot();
console.log("Sin variable de entorno (lo que corre en producción)");
ok(/haiku-4-5/.test(ens.model), `la práctica usa Haiku 4.5 (${ens.model})`);
ok(/haiku-4-5/.test(bot.model), `el bot usa Haiku 4.5 (${bot.model})`);
ok(!ens.thinking, "la práctica NO manda razonamiento");
ok(!bot.reasoning, "el bot NO manda razonamiento");
ok(ens.max_tokens > 0 && bot.max_tokens > 0, "los dos dejan sitio para la respuesta");
ok(ens.temperature === undefined || ens.temperature === 1, "no manda una temperatura que la API rechazaría");

// ── Si se vuelve a encender, tiene que encenderse en los DOS a la vez ─────────
console.log("\nCon RAZONAMIENTO_ENSAYO=1024 (marcha atrás)");
process.env.RAZONAMIENTO_ENSAYO = "1024";
const ensOn = pedirEnsayo();
const botOn = pedirBot();
ok(ensOn.thinking?.type === "enabled", "la práctica vuelve a pensar");
ok(!!botOn.reasoning, "el bot vuelve a pensar");
ok(
  (ensOn.thinking?.budget_tokens ?? 0) === (botOn.reasoning?.max_tokens ?? -1),
  "los dos razonan con el MISMO presupuesto (si no, Mary ensaya con otro bot)"
);
ok((ensOn.thinking?.budget_tokens ?? 0) >= 1024, `el presupuesto llega al mínimo de Anthropic (${ensOn.thinking?.budget_tokens})`);
ok(ensOn.max_tokens > (ensOn.thinking?.budget_tokens ?? 0), `max_tokens de la práctica (${ensOn.max_tokens}) deja sitio a la respuesta, no solo al razonamiento`);
ok(botOn.max_tokens > (botOn.reasoning?.max_tokens ?? 0), `max_tokens del bot (${botOn.max_tokens}) deja sitio a la respuesta`);
delete process.env.RAZONAMIENTO_ENSAYO;

// ── Si OpenRouter no quisiera el razonamiento, el bot NO puede quedarse mudo ──
// La red de seguridad se queda aunque hoy vaya apagado: el día que se encienda, ese camino
// no se puede probar desde el computador de Lukas (la clave de OpenRouter vive en producción).
console.log("\nRed de seguridad");
ok(esErrorDeRazonamiento(new Error('400 Unrecognized request argument supplied: reasoning')), "reconoce el rechazo del parámetro");
ok(esErrorDeRazonamiento(new Error('unsupported_value: thinking is not supported for this model')), "reconoce que el modelo no soporta pensar");
ok(!esErrorDeRazonamiento(new Error("401 No auth credentials found")), "una clave mala NO se confunde con esto");
ok(!esErrorDeRazonamiento(new Error("429 rate limited")), "un límite de uso tampoco");
process.env.RAZONAMIENTO_ENSAYO = "1024";
const sinRazonar = cuerpoBot([{ role: "user", content: "hola" }], false) as { reasoning?: unknown };
ok(!sinRazonar.reasoning, "el reintento va sin el parámetro que rechazaron");
delete process.env.RAZONAMIENTO_ENSAYO;

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
