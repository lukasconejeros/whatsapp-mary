import "./env-loader.js";
import {
  addIngreso, listIngresos, updateIngreso, deleteIngreso, upsertIngresoFromAirtable,
  addCosto, listCostos, deleteCosto, upsertCostoFromAirtable,
  upsertCliente, getClienteByPhone,
} from "../src/lib/db.js";
import { formatCLP, currentMonth, shiftMonth } from "../src/lib/finanzas.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST finanzas\n");

// helpers puros
check("formatCLP", formatCLP(1234567) === "$1.234.567", `(=${formatCLP(1234567)})`);
check("shiftMonth retrocede año", shiftMonth("2026-01", -1) === "2025-12", `(=${shiftMonth("2026-01",-1)})`);
check("currentMonth formato", /^\d{4}-\d{2}$/.test(currentMonth()), `(=${currentMonth()})`);

// ingresos (mes de prueba aislado 1990-01)
const i1 = addIngreso({ fecha: "1990-01-15", apoderado: "Test", monto: 100000, tipo: "Taller - plan basico", detalle: "x" });
const ing = listIngresos("1990-01");
check("addIngreso + listIngresos(mes)", ing.some(r => r.id === i1 && r.monto === 100000));
updateIngreso(i1, { fecha: "1990-01-15", apoderado: "Test", monto: 120000, tipo: "Taller - plan basico", detalle: "y" });
check("updateIngreso cambia monto", listIngresos("1990-01").find(r => r.id === i1)?.monto === 120000);

// upsert idempotente por airtable_id
upsertIngresoFromAirtable({ airtableId: "recTESTING1", fecha: "1990-01-20", monto: 50000, tipo: "kit de arte" });
upsertIngresoFromAirtable({ airtableId: "recTESTING1", fecha: "1990-01-20", monto: 55000, tipo: "kit de arte" });
const dupe = listIngresos("1990-01").filter(r => r.airtable_id === "recTESTING1");
check("upsert airtable_id no duplica", dupe.length === 1 && dupe[0].monto === 55000, `(n=${dupe.length})`);

// costos
const c1 = addCosto({ fecha: "1990-01-10", tipo: "Pinturas (costo variable)", cantidad: 3, valor: 30000, notas: "n" });
check("addCosto + listCostos(mes)", listCostos("1990-01").some(r => r.id === c1 && r.valor === 30000));
upsertCostoFromAirtable({ airtableId: "recTESTC1", fecha: "1990-01-11", valor: 9000, tipo: "gastos" });
upsertCostoFromAirtable({ airtableId: "recTESTC1", fecha: "1990-01-11", valor: 9500, tipo: "gastos" });
check("upsert costo no duplica", listCostos("1990-01").filter(r => r.airtable_id === "recTESTC1").length === 1);

// clientes extendido
upsertCliente({ nombre: "Apo Test", telefono: "56977770001", email: "a@b.cl", estado: "pagado", horario: ["Lunes","Viernes"] });
const cli = getClienteByPhone("56977770001");
check("cliente guarda email/estado/horario", !!cli && cli.email === "a@b.cl" && cli.estado === "pagado" && (cli.horario ?? "").includes("Lunes"), `(${JSON.stringify(cli)})`);

// limpieza
for (const r of listIngresos("1990-01")) deleteIngreso(r.id);
for (const r of listCostos("1990-01")) deleteCosto(r.id);

console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
