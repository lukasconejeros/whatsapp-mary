// Test de la bandeja de BORRADORES de comprobante: guardar, listar, aprobar, descartar.
// Corre contra la DB local usando un teléfono reservado (5699000802X) y limpiando SOLO
// sus propias filas (nunca un DELETE a secas: la tabla puede tener trabajo real).
import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import {
  getOrCreateConversation, setCategoria, deleteConversation,
  addBorradorComprobante, listBorradoresPendientes, getBorradorComprobante,
  aprobarBorradorComprobante, descartarBorradorComprobante,
  listIngresos, setIngresoDeMeta, deleteIngreso,
} from "../src/lib/db.js";

const TEL = "56990008021";
const FECHA = "2026-08-05";
const MES = "2026-08";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") {
  if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; }
}

// ── Limpieza acotada a lo de esta prueba ──────────────────────────────────
const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
const previa = raw.prepare("SELECT id FROM conversations WHERE phone = ?").get(TEL) as { id: number } | undefined;
if (previa) {
  try { raw.prepare("DELETE FROM comprobantes WHERE conversation_id = ?").run(previa.id); } catch { /* tabla aún no existe */ }
  raw.prepare("DELETE FROM ingresos WHERE detalle LIKE '%TEST-COMPROBANTE%'").run();
  deleteConversation(previa.id);
}

console.log("\n🧪 TEST bandeja de borradores de comprobante\n");

const conv = getOrCreateConversation(TEL, "Apoderada de Prueba");
setCategoria(conv.id, "potencial", false); // pestaña Meta

// ── Guardar el borrador ───────────────────────────────────────────────────
console.log("— guardar —");
const idB = addBorradorComprobante({
  conversationId: conv.id, media: "test-comprobante.jpg", monto: 20000, fecha: FECHA,
  nombre: "Apoderada de Prueba", banco: "BancoEstado", esperado: true, deMeta: true,
});
check("guardar devuelve un id", typeof idB === "number" && idB > 0, String(idB));

const b = getBorradorComprobante(idB);
check("nace pendiente", b?.estado === "pendiente", b?.estado);
check("guarda el monto", b?.monto === 20000);
check("guarda la foto para que Mary la vea", b?.media === "test-comprobante.jpg");
check("guarda que vino de Meta", b?.de_meta === 1);
check("todavía no hay ingreso enlazado", b?.ingreso_id === null);

const pend = listBorradoresPendientes();
check("aparece en la bandeja de pendientes", pend.some((x) => x.id === idB));
check("la bandeja trae el nombre del contacto", pend.find((x) => x.id === idB)?.contacto === "Apoderada de Prueba");

// ── Aprobar: recién ahí nace el ingreso ───────────────────────────────────
console.log("\n— aprobar —");
const antes = listIngresos(MES).length;
const idIng = aprobarBorradorComprobante(idB, { tipo: "Clase de prueba", detalle: "TEST-COMPROBANTE" });
check("aprobar devuelve el id del ingreso", typeof idIng === "number" && (idIng as number) > 0, String(idIng));

const ingresos = listIngresos(MES);
const ing = ingresos.find((i) => i.id === idIng);
check("el ingreso quedó creado", ingresos.length === antes + 1, `${antes} → ${ingresos.length}`);
check("con el monto del comprobante", ing?.monto === 20000);
check("con la fecha del comprobante", ing?.fecha === FECHA);
check("con el apoderado", ing?.apoderado === "Apoderada de Prueba");
check("con la FOTO adjunta", ing?.media === "test-comprobante.jpg", String(ing?.media));
check("marcado como venido de Meta", ing?.de_meta === 1, String(ing?.de_meta));

const b2 = getBorradorComprobante(idB);
check("el borrador queda aprobado", b2?.estado === "aprobado", b2?.estado);
check("y enlazado a su ingreso", b2?.ingreso_id === idIng);
check("ya no está en la bandeja", !listBorradoresPendientes().some((x) => x.id === idB));

// Doble toque en el botón: no puede cobrar dos veces.
const idIng2 = aprobarBorradorComprobante(idB, { tipo: "Clase de prueba", detalle: "TEST-COMPROBANTE" });
check("aprobar dos veces NO duplica el ingreso", idIng2 === idIng && listIngresos(MES).length === antes + 1,
  `${idIng} vs ${idIng2}, ${listIngresos(MES).length}`);

// ── La marca de Meta se puede corregir a mano ─────────────────────────────
console.log("\n— corregir la marca de Meta —");
setIngresoDeMeta(idIng as number, false);
check("se puede desmarcar", listIngresos(MES).find((i) => i.id === idIng)?.de_meta === 0);
setIngresoDeMeta(idIng as number, true);
check("y volver a marcar", listIngresos(MES).find((i) => i.id === idIng)?.de_meta === 1);

// ── Descartar: no deja rastro en las cifras ───────────────────────────────
console.log("\n— descartar —");
const idB2 = addBorradorComprobante({
  conversationId: conv.id, media: "otra.jpg", monto: 37500, fecha: FECHA,
  nombre: null, banco: null, esperado: false, deMeta: true,
});
const cuenta = listIngresos(MES).length;
descartarBorradorComprobante(idB2);
check("queda descartado", getBorradorComprobante(idB2)?.estado === "descartado");
check("sale de la bandeja", !listBorradoresPendientes().some((x) => x.id === idB2));
check("NO crea ningún ingreso", listIngresos(MES).length === cuenta);
check("un descartado ya no se puede aprobar", aprobarBorradorComprobante(idB2, {}) === null);

// ── Limpieza ──────────────────────────────────────────────────────────────
deleteIngreso(idIng as number);
raw.prepare("DELETE FROM comprobantes WHERE conversation_id = ?").run(conv.id);
deleteConversation(conv.id);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
