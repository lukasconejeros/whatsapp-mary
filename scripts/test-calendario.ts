import "./env-loader.js";
import { addClase, listClases, updateClase, deleteClase, upsertCliente, listClientes } from "../src/lib/db.js";
import { DIAS, DIA_LABEL, PROFES } from "../src/lib/calendario.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST calendario\n");

check("DIAS = Lun..Sab (6)", DIAS.length === 6 && DIAS[0] === "Lunes" && DIAS[5] === "Sabado");
check("DIA_LABEL pone tilde", DIA_LABEL["Miercoles"] === "Miércoles" && DIA_LABEL["Sabado"] === "Sábado");
check("PROFES = 2 (Mary y Paula) con color", PROFES.length === 2 && PROFES.every(p => /^#/.test(p.color)));

// CRUD de clases
const cid = addClase({ dia: "Lunes", profe: "Mary", hora: "16:00", alumnos: [1, 2], nota: "x" });
const cl = listClases();
const found = cl.find(c => c.id === cid);
check("addClase + listClases", !!found && found.dia === "Lunes" && found.profe === "Mary");
check("alumnos se guardan como array", !!found && Array.isArray(found.alumnos) && found.alumnos.length === 2, `(${JSON.stringify(found?.alumnos)})`);
updateClase(cid, { dia: "Lunes", profe: "Paula", hora: "17:30", alumnos: [3], nota: "y" });
const upd = listClases().find(c => c.id === cid);
check("updateClase cambia profe/hora/alumnos", !!upd && upd.profe === "Paula" && upd.hora === "17:30" && upd.alumnos[0] === 3);

// listClientes con horario parseado
upsertCliente({ nombre: "Cal Test", telefono: "56988880001", horario: ["Lunes", "Jueves"] });
const lc = listClientes().find(c => c.telefono === "56988880001");
check("listClientes parsea horario a array", !!lc && Array.isArray(lc.horario) && lc.horario.includes("Lunes"), `(${JSON.stringify(lc?.horario)})`);

// limpieza
deleteClase(cid);
check("deleteClase", !listClases().some(c => c.id === cid));

console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
