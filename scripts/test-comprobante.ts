// Test de la lógica pura que convierte lo que ve el modelo en un BORRADOR de ingreso.
// Decisión de Lukas (05-08-2026): nada entra solo a Ingresos; se propone y Mary aprueba.
// Por eso lo que se prueba aquí es sobre todo cuándo NO hay que proponer nada.
import "./env-loader.js";
import {
  normalizarMonto, esMontoEsperado, interpretarComprobante, MONTOS_ESPERADOS,
} from "../src/lib/comprobante.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST comprobante de transferencia → borrador de ingreso\n");

const HOY = "2026-08-05";
const json = (o: Record<string, unknown>) => JSON.stringify(o);
const ok = (over: Record<string, unknown> = {}) =>
  json({ es_comprobante: true, monto: 20000, fecha: HOY, nombre: "Ana Pérez", banco: "BancoEstado", ...over });

// ── normalizarMonto: el modelo puede devolver el monto de mil formas ───────
console.log("— normalizarMonto —");
check("entero tal cual", normalizarMonto(20000) === 20000);
check("con puntos de miles chilenos", normalizarMonto("19.990") === 19990, String(normalizarMonto("19.990")));
check("con signo peso y espacios", normalizarMonto(" $120.000 ") === 120000, String(normalizarMonto(" $120.000 ")));
check("con CLP pegado", normalizarMonto("CLP 75.000") === 75000, String(normalizarMonto("CLP 75.000")));
check("decimales chilenos se ignoran", normalizarMonto("60.000,00") === 60000, String(normalizarMonto("60.000,00")));
check("cero no es monto", normalizarMonto(0) === null);
check("negativo no es monto", normalizarMonto(-5000) === null);
check("texto sin cifra", normalizarMonto("no se ve") === null);
check("null", normalizarMonto(null) === null);
check("monto absurdo por alto se descarta", normalizarMonto(999_000_000) === null);

// ── Montos que Lukas nombró: sirven para marcar el borrador como esperado ──
console.log("\n— montos esperados de Arteluk —");
check("la clase de prueba de 20.000", esMontoEsperado(20000));
check("la clase de prueba de 19.990", esMontoEsperado(19990));
check("mensualidades 60/75/120 mil", esMontoEsperado(60000) && esMontoEsperado(75000) && esMontoEsperado(120000));
check("un monto cualquiera NO es esperado", !esMontoEsperado(37500));
check("la lista está publicada", MONTOS_ESPERADOS.includes(19990) && MONTOS_ESPERADOS.length >= 5);

// ── interpretarComprobante: el corazón del asunto ─────────────────────────
console.log("\n— interpretarComprobante —");
const b = interpretarComprobante(ok(), HOY);
check("comprobante limpio da borrador", b !== null && b.monto === 20000, JSON.stringify(b));
check("se queda con el nombre de quien transfirió", b?.nombre === "Ana Pérez");
check("marca que el monto es esperado", b?.esperado === true);
check("guarda el banco para que Mary reconozca la foto", b?.banco === "BancoEstado");

check("si NO es comprobante no se propone nada",
  interpretarComprobante(json({ es_comprobante: false, monto: 20000 }), HOY) === null);
check("un cuadro de un niño no es comprobante",
  interpretarComprobante(json({ es_comprobante: false, monto: null, nombre: null }), HOY) === null);
check("comprobante SIN monto legible no se propone",
  interpretarComprobante(ok({ monto: null }), HOY) === null);
check("comprobante con monto 0 no se propone",
  interpretarComprobante(ok({ monto: 0 }), HOY) === null);

// El modelo suele envolver el JSON en un bloque de código: no puede romperlo.
check("JSON envuelto en ```json``` igual se lee",
  interpretarComprobante("```json\n" + ok() + "\n```", HOY)?.monto === 20000);
check("JSON con texto alrededor igual se lee",
  interpretarComprobante("Claro, aquí tienes:\n" + ok() + "\nEspero que sirva.", HOY)?.monto === 20000);
check("respuesta que no es JSON no revienta",
  interpretarComprobante("No puedo ayudarte con eso.", HOY) === null);
check("respuesta vacía no revienta", interpretarComprobante("", HOY) === null);

// Fechas: la del comprobante manda, pero solo si es creíble.
console.log("\n— fecha del ingreso —");
check("usa la fecha del comprobante", interpretarComprobante(ok({ fecha: "2026-08-03" }), HOY)?.fecha === "2026-08-03");
check("sin fecha usa la de hoy", interpretarComprobante(ok({ fecha: null }), HOY)?.fecha === HOY);
check("fecha ilegible usa la de hoy", interpretarComprobante(ok({ fecha: "el martes" }), HOY)?.fecha === HOY);
check("fecha futura usa la de hoy", interpretarComprobante(ok({ fecha: "2027-01-01" }), HOY)?.fecha === HOY,
  String(interpretarComprobante(ok({ fecha: "2027-01-01" }), HOY)?.fecha));
check("fecha muy vieja usa la de hoy", interpretarComprobante(ok({ fecha: "2019-05-05" }), HOY)?.fecha === HOY);

// Un monto raro NO bloquea el borrador: Mary lo ve y decide (por eso es borrador).
console.log("\n— monto no esperado —");
const raro = interpretarComprobante(ok({ monto: 37500 }), HOY);
check("monto raro igual propone borrador", raro !== null && raro.monto === 37500);
check("pero queda marcado como NO esperado", raro?.esperado === false);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
