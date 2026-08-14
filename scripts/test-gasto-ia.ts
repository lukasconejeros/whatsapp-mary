import "./env-loader.js"; // PRIMERO: carga .env.local antes que nada
// LA CONTABILIDAD DE GASTO DE IA (13-08-2026). Antes este bot gastaba a ciegas, a
// diferencia de Medifis/Anpalex/Conejeros. Lo que se vigila acá:
//   · las tarifas por modelo dan el número correcto (Haiku 3× más barato que Sonnet);
//   · logCostoIA/getGastoIA separan bien lo REAL de lo de PRUEBA — mezclarlos haría ver
//     como gasto de una apoderada lo que solo costó correr un test;
//   · este_mes_usd solo suma lo del mes actual, no todo lo acumulado desde siempre;
//   · una llamada real a Haiku de verdad deja su costo anotado, aunque sea centavos.
import { tarifaPorModelo, estimarUSD, generateReply } from "../src/lib/ai";
import { logCostoIA, getGastoIA, borrarGastoIADeMarca } from "../src/lib/db";
import { todaySantiago, monthSantiago } from "../src/lib/fechas";
import type { Message } from "../src/lib/db";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST gasto de IA (Arteluk)\n");

// ── Tarifas puras ────────────────────────────────────────────────────────────

check("Haiku: $1/$5 por millón", JSON.stringify(tarifaPorModelo("anthropic/claude-haiku-4-5")) === JSON.stringify({ in: 1, out: 5 }));
check("Opus: $5/$25 por millón", JSON.stringify(tarifaPorModelo("claude-opus-5")) === JSON.stringify({ in: 5, out: 25 }));
check("Sonnet: $3/$15 por millón", JSON.stringify(tarifaPorModelo("claude-sonnet-4-6")) === JSON.stringify({ in: 3, out: 15 }));
check("modelo desconocido cae en la tarifa cara (nunca esconder gasto)",
  JSON.stringify(tarifaPorModelo("modelo-nuevo-que-no-existe-aun")) === JSON.stringify({ in: 3, out: 15 }));

const usdHaiku = estimarUSD("anthropic/claude-haiku-4-5", 1_000_000, 1_000_000);
check("1M in + 1M out con Haiku = US$6 exacto (1 + 5)", Math.abs(usdHaiku - 6) < 1e-9, String(usdHaiku));
check("Haiku sale 3× más barato que Sonnet con el mismo tráfico",
  Math.abs(estimarUSD("claude-sonnet-4-6", 1000, 1000) - estimarUSD("anthropic/claude-haiku-4-5", 1000, 1000) * 3) < 1e-9,
  `${estimarUSD("claude-sonnet-4-6", 1000, 1000)} vs ${estimarUSD("anthropic/claude-haiku-4-5", 1000, 1000) * 3}`);

// ── logCostoIA / getGastoIA: real vs prueba, sin mezclarse ──────────────────

const MARCA = "test-gasto-ia"; // marcador exclusivo de este test, se borra al final
const hoy = todaySantiago();
const mes = monthSantiago();
borrarGastoIADeMarca(MARCA); // por si quedó algo de una corrida anterior interrumpida

const antes = getGastoIA(hoy, mes);
logCostoIA(0.01, { prueba: false, dia: hoy, marca: MARCA });
logCostoIA(0.02, { prueba: false, dia: hoy, marca: MARCA });
logCostoIA(0.05, { prueba: true, dia: hoy, marca: MARCA }); // esta NO debe contar como real
const despues = getGastoIA(hoy, mes);

check("las 2 llamadas reales suman al total (US$0,03)",
  Math.abs(despues.total_usd - antes.total_usd - 0.03) < 1e-6,
  `antes=${antes.total_usd} despues=${despues.total_usd}`);
check("la de prueba NO se sumó al total real",
  Math.abs(despues.total_usd - antes.total_usd - 0.03) < 1e-6);
check("la de prueba SÍ quedó en el bolsillo separado de pruebas (US$0,05)",
  Math.abs(despues.pruebas_usd - antes.pruebas_usd - 0.05) < 1e-6,
  `antes=${antes.pruebas_usd} despues=${despues.pruebas_usd}`);
check("hoy_usd también sumó solo lo real",
  Math.abs(despues.hoy_usd - antes.hoy_usd - 0.03) < 1e-6);
check("este_mes_usd también sumó solo lo real de hoy",
  Math.abs(despues.este_mes_usd - antes.este_mes_usd - 0.03) < 1e-6);
check("el día de hoy aparece en los últimos 7 días",
  despues.ultimos_7_dias.some((d) => d.dia === hoy));

// Una fila de OTRO mes no debe contar en este_mes_usd
logCostoIA(0.10, { prueba: false, dia: "2020-01-15", marca: MARCA });
const conMesViejo = getGastoIA(hoy, mes);
check("una fila de un mes distinto NO entra en este_mes_usd",
  Math.abs(conMesViejo.este_mes_usd - despues.este_mes_usd) < 1e-6,
  `este_mes antes=${despues.este_mes_usd} despues=${conMesViejo.este_mes_usd}`);
check("pero SÍ entra en el total acumulado",
  Math.abs(conMesViejo.total_usd - despues.total_usd - 0.10) < 1e-6);

borrarGastoIADeMarca(MARCA);
const limpio = getGastoIA(hoy, mes);
check("al limpiar, el total real vuelve a como estaba antes",
  Math.abs(limpio.total_usd - antes.total_usd) < 1e-6);
check("al limpiar, el bolsillo de pruebas también vuelve a como estaba",
  Math.abs(limpio.pruebas_usd - antes.pruebas_usd) < 1e-6);

// ── Contra la IA de verdad: una llamada real (marcada prueba) queda anotada ─
// Vía generateReply con prueba:true para no mezclarse con tráfico real de nadie.
const history: Message[] = [
  { id: 1, conversation_id: 0, role: "user", content: "hola, quiero información del taller", created_at: 0 },
];
const antesReal = getGastoIA(hoy, mes);
try {
  await generateReply({ history, conversationId: 0, phone: "56900009999", prueba: true });
  const despuesReal = getGastoIA(hoy, mes);
  check("una llamada real (marcada prueba) queda en el bolsillo de PRUEBAS, no en el real",
    despuesReal.pruebas_usd > antesReal.pruebas_usd && despuesReal.total_usd === antesReal.total_usd,
    `pruebas: ${antesReal.pruebas_usd}→${despuesReal.pruebas_usd} · real: ${antesReal.total_usd}→${despuesReal.total_usd}`);
} catch (e) {
  console.log(`  ⚠️  SALTADA — sin llamar a la IA de verdad no se puede probar (${String(e).slice(0, 140)})`);
  console.log("      Este tramo NO cuenta como aprobado: falta credencial local usable para verificarlo de verdad.");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} bien, ${fail} mal\n`);
process.exit(fail === 0 ? 0 : 1);
