// Test de las rutas que usa la BANDEJA de comprobantes del panel de Finanzas.
// Ejercita los handlers HTTP de verdad (los mismos que llama el navegador), no la DB
// directa: eso ya lo cubre test:comprobantes-db. Aquí lo que se prueba es que el botón
// "Aprobar" de Mary termine creando el ingreso y que "Descartar" no cree nada.
// Usa un teléfono reservado (5699000802X) y limpia SOLO sus propias filas.
import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import {
  getOrCreateConversation, setCategoria, deleteConversation,
  addBorradorComprobante, getBorradorComprobante,
  listIngresos, deleteIngreso,
} from "../src/lib/db.js";
import { GET as listarComprobantes } from "../src/app/api/comprobantes/route.js";
import { POST as accionComprobante } from "../src/app/api/comprobantes/[id]/route.js";
import { PATCH as patchIngreso } from "../src/app/api/ingresos/[id]/route.js";
import type { NextRequest } from "next/server";

const TEL = "56990008022";
const FECHA = "2026-08-05";
const MES = "2026-08";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") {
  if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; }
}

// Un POST/PATCH con cuerpo JSON, como lo manda el navegador.
function req(body: unknown): NextRequest {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}
const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

// ── Limpieza acotada ──────────────────────────────────────────────────────
const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
const previa = raw.prepare("SELECT id FROM conversations WHERE phone = ?").get(TEL) as { id: number } | undefined;
if (previa) {
  try { raw.prepare("DELETE FROM comprobantes WHERE conversation_id = ?").run(previa.id); } catch { /* tabla aún no existe */ }
  raw.prepare("DELETE FROM ingresos WHERE detalle LIKE '%TEST-API-COMPROBANTE%'").run();
  deleteConversation(previa.id);
}

console.log("\n🧪 TEST rutas de la bandeja de comprobantes\n");

const conv = getOrCreateConversation(TEL, "Apoderada API");
setCategoria(conv.id, "potencial", false);
const idB = addBorradorComprobante({
  conversationId: conv.id, media: "test-api.jpg", monto: 20000, fecha: FECHA,
  nombre: "Apoderada API", banco: "BancoEstado", esperado: true, deMeta: true,
});

// ── Listar ────────────────────────────────────────────────────────────────
console.log("— listar lo que espera aprobación —");
const lista = await (await listarComprobantes()).json() as {
  ok: boolean; comprobantes: Array<{ id: number; monto: number; media: string | null; contacto: string | null }>;
};
check("responde ok", lista.ok === true);
const fila = lista.comprobantes.find((c) => c.id === idB);
check("el borrador aparece en la bandeja", !!fila);
check("trae la foto para mirarla", fila?.media === "test-api.jpg", String(fila?.media));
check("trae de quién es", fila?.contacto === "Apoderada API", String(fila?.contacto));
check("trae el monto", fila?.monto === 20000);

// ── Aprobar (con lo que Mary corrigió en pantalla) ────────────────────────
console.log("\n— aprobar —");
const antes = listIngresos(MES).length;
const okAprobar = await (await accionComprobante(
  req({ accion: "aprobar", monto: 19990, tipo: "Taller - plan basico", detalle: "TEST-API-COMPROBANTE" }),
  ctx(idB),
)).json() as { ok: boolean; ingresoId: number };
check("aprobar responde ok con el id del ingreso", okAprobar.ok === true && okAprobar.ingresoId > 0, JSON.stringify(okAprobar));

const ing = listIngresos(MES).find((i) => i.id === okAprobar.ingresoId);
check("el ingreso quedó creado", listIngresos(MES).length === antes + 1, `${antes} → ${listIngresos(MES).length}`);
check("con el monto CORREGIDO en pantalla, no el leído", ing?.monto === 19990, String(ing?.monto));
check("con la categoría que eligió Mary", ing?.tipo === "Taller - plan basico", String(ing?.tipo));
check("con la foto del comprobante adjunta", ing?.media === "test-api.jpg", String(ing?.media));
check("marcado como venido de Meta", ing?.de_meta === 1, String(ing?.de_meta));
check("el borrador sale de la bandeja", getBorradorComprobante(idB)?.estado === "aprobado");

// Doble toque al botón (dedo nervioso o internet lento): no puede cobrar dos veces.
const repetido = await (await accionComprobante(
  req({ accion: "aprobar", monto: 19990, tipo: "Taller - plan basico", detalle: "TEST-API-COMPROBANTE" }),
  ctx(idB),
)).json() as { ok: boolean; ingresoId: number };
check("doble toque NO duplica el ingreso",
  repetido.ingresoId === okAprobar.ingresoId && listIngresos(MES).length === antes + 1,
  `${okAprobar.ingresoId} vs ${repetido.ingresoId}, ${listIngresos(MES).length}`);

// ── El interruptor "vino de Meta" de la lista de Ingresos ─────────────────
console.log("\n— corregir a mano si vino de Meta —");
const off = await (await patchIngreso(req({ deMeta: false }), ctx(okAprobar.ingresoId))).json() as { ok: boolean };
check("desmarcar responde ok", off.ok === true);
check("y queda desmarcado", listIngresos(MES).find((i) => i.id === okAprobar.ingresoId)?.de_meta === 0);
await patchIngreso(req({ deMeta: true }), ctx(okAprobar.ingresoId));
check("se puede volver a marcar", listIngresos(MES).find((i) => i.id === okAprobar.ingresoId)?.de_meta === 1);

// ── Descartar ─────────────────────────────────────────────────────────────
console.log("\n— descartar —");
const idB2 = addBorradorComprobante({
  conversationId: conv.id, media: "otra-api.jpg", monto: 37500, fecha: FECHA,
  nombre: null, banco: null, esperado: false, deMeta: false,
});
const cuenta = listIngresos(MES).length;
const desc = await (await accionComprobante(req({ accion: "descartar" }), ctx(idB2))).json() as { ok: boolean };
check("descartar responde ok", desc.ok === true);
check("queda descartado", getBorradorComprobante(idB2)?.estado === "descartado");
check("NO crea ningún ingreso", listIngresos(MES).length === cuenta, `${cuenta} → ${listIngresos(MES).length}`);

// ── Entradas malas: no pueden reventar el panel ni inventar plata ─────────
console.log("\n— entradas malas —");
const idMalo = await (await accionComprobante(req({ accion: "aprobar" }), ctx("abc"))).status;
check("id que no es número → 400", idMalo === 400, String(idMalo));
const sinAccion = await (await accionComprobante(req({}), ctx(idB))).status;
check("sin acción → 400", sinAccion === 400, String(sinAccion));
const inexistente = await accionComprobante(req({ accion: "aprobar" }), ctx(99999999));
check("borrador inexistente → 404", inexistente.status === 404, String(inexistente.status));
const cuentaFinal = listIngresos(MES).length;
check("ninguna entrada mala creó plata", cuentaFinal === cuenta, `${cuenta} → ${cuentaFinal}`);
const patchMalo = await patchIngreso(req({ deMeta: "sí" }), ctx(okAprobar.ingresoId));
check("PATCH con deMeta que no es booleano → 400", patchMalo.status === 400, String(patchMalo.status));

// ── Limpieza ──────────────────────────────────────────────────────────────
deleteIngreso(okAprobar.ingresoId);
raw.prepare("DELETE FROM comprobantes WHERE conversation_id = ?").run(conv.id);
deleteConversation(conv.id);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
