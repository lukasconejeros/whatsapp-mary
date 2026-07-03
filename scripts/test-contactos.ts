import "./env-loader.js";
import {
  upsertCliente,
  searchClientes,
  setClienteEstado,
  getClienteByPhone,
  normalizarTexto,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST contactos (búsqueda difusa + estado)\n");

// normalizarTexto: sin acentos, minúsculas
check("normalizarTexto quita acentos", normalizarTexto("José Peñá") === "jose pena", normalizarTexto("José Peñá"));

// Semilla: un apoderado con hijo de nombre acentuado
const tel = "+56990000001";
upsertCliente({ nombre: "Genoveva Montero", telefono: tel, alumnos: "Amparo Coronado", estado: "activo" });

// Buscar por el nombre del niño
const porNino = searchClientes("amparo");
check("busca por nombre del niño ('amparo')", porNino.some(c => c.telefono === "56990000001"));

// Buscar por apoderado, sin acento
upsertCliente({ nombre: "Sofía Núñez", telefono: "+56990000002", alumnos: "León", estado: "activo" });
check("busca apoderado ignorando acentos ('sofia')", searchClientes("sofia").some(c => c.telefono === "56990000002"));
check("busca niño ignorando acentos ('leon')", searchClientes("leon").some(c => c.telefono === "56990000002"));

// Estado toggle
setClienteEstado(tel, "inactivo");
check("setClienteEstado marca inactivo", getClienteByPhone(tel)?.estado === "inactivo");
setClienteEstado(tel, "activo");
check("setClienteEstado vuelve a activo", getClienteByPhone(tel)?.estado === "activo");

// Búsqueda vacía no rompe
check("término vacío devuelve []", searchClientes("   ").length === 0);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
