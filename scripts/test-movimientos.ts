import "./env-loader.js";
import Database from "better-sqlite3";
import { addMovimiento, listMovimientos } from "../src/lib/db.js";
import { nowSantiago, todaySantiago, monthSantiago } from "../src/lib/fechas.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST movimientos\n");

check("nowSantiago formato", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(nowSantiago()), `(=${nowSantiago()})`);
check("todaySantiago formato", /^\d{4}-\d{2}-\d{2}$/.test(todaySantiago()), `(=${todaySantiago()})`);
check("monthSantiago formato", /^\d{4}-\d{2}$/.test(monthSantiago()), `(=${monthSantiago()})`);

const g = addMovimiento({ fecha: "1990-02-10 12:00", tipo: "gasto", monto: 12000, categoria: "Supermercado", descripcion: "verduras", origen: "texto", chat_id: "111" });
const i = addMovimiento({ fecha: "1990-02-11 09:00", tipo: "ingreso", monto: 50000, categoria: "Clase", descripcion: "pago", origen: "audio", chat_id: "111" });
const mes = listMovimientos({ mes: "1990-02" });
check("addMovimiento + listMovimientos(mes)", mes.some(m => m.id === g) && mes.some(m => m.id === i) && mes.length >= 2);
check("guarda tipo/monto/origen", !!mes.find(m => m.id === g && m.tipo === "gasto" && m.monto === 12000 && m.origen === "texto"));
const soloSuper = listMovimientos({ mes: "1990-02", categoria: "Supermercado" });
check("filtro por categoria", soloSuper.length === 1 && soloSuper[0].id === g, `(n=${soloSuper.length})`);
check("orden fecha DESC", mes[0].fecha >= mes[mes.length - 1].fecha);

// limpieza directa (no hay delete público; es solo lectura)
new Database("data/messages.db").prepare("DELETE FROM movimientos WHERE fecha LIKE '1990-02%'").run();

console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
