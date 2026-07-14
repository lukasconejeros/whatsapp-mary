import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import {
  getOrCreateConversation,
  setCategoria,
  setCerrado,
  getLeadsMeta,
  getLeadsSeguimiento,
  enqueueSeguimientos,
  getSeguimientoPendiente,
  markSeguimientoEnviado,
  countSeguimientosEnviadosDia,
  getSeguimientoStats,
  omitirSeguimientosPendientes,
  insertMessage,
  deleteConversation,
} from "../src/lib/db.js";
import { todaySantiago } from "../src/lib/fechas.js";
import { personalizarMensaje, MENSAJE_META_DEFAULT, MENSAJE_SEGUIMIENTO_DEFAULT } from "../src/lib/seguimiento.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST campaña de seguimiento (cola + tope + anti-baneo)\n");

const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
const hoy = todaySantiago();

// 3 leads de prueba: A y B = CERRADOS (en Seguimiento, candidatos), C = abierto (Meta).
const A = getOrCreateConversation("56900000SEGA", "Lead A");
const B = getOrCreateConversation("56900000SEGB", "Lead B");
const C = getOrCreateConversation("56900000SEGC", "Lead C");
for (const c of [A, B, C]) setCategoria(c.id, "potencial", true);
setCerrado(A.id, true);
setCerrado(B.id, true);
const ids = [A.id, B.id, C.id];
raw.prepare(`DELETE FROM seguimientos WHERE conversation_id IN (${ids.join(",")})`).run();
const baseEnviadosHoy = countSeguimientosEnviadosDia(hoy);

// 1) Audiencias: Seguimiento incluye A y B (cerrados); Meta incluye C (abierto).
const candSeg = getLeadsSeguimiento().map(l => l.id);
const candMeta = getLeadsMeta().map(l => l.id);
check("Seguimiento incluye lead cerrado A", candSeg.includes(A.id));
check("Seguimiento incluye lead cerrado B", candSeg.includes(B.id));
check("Seguimiento EXCLUYE lead abierto C", !candSeg.includes(C.id));
check("Meta incluye lead abierto C", candMeta.includes(C.id));
check("Meta EXCLUYE lead cerrado A", !candMeta.includes(A.id));

// 2) Encolar: agrega A y B (2) con su mensaje ya personalizado.
const items = getLeadsSeguimiento().filter(l => ids.includes(l.id)).map(l => ({ id: l.id, phone: l.phone, mensaje: personalizarMensaje(MENSAJE_SEGUIMIENTO_DEFAULT, l.name, null) }));
const agregados = enqueueSeguimientos(items);
check("encola 2 (A y B)", agregados === 2, String(agregados));

// 3) Dedup: reencolar no agrega nada (ya tienen pendiente).
check("reencolar no duplica (0)", enqueueSeguimientos(items) === 0);

// 4) FIFO: el pendiente más antiguo sale primero (A antes que B) y trae su mensaje.
const p1 = getSeguimientoPendiente();
check("pendiente FIFO = A primero", p1?.conversation_id === A.id, String(p1?.conversation_id));
check("pendiente trae el mensaje ya listo", !!p1?.mensaje && p1.mensaje.includes("Arteluk"), p1?.mensaje ?? "");

// 5) Marcar enviado A: sube el contador del día en 1; ya no vuelve a salir.
markSeguimientoEnviado(p1!.id, "msg", hoy);
check("enviadosHoy sube en 1", countSeguimientosEnviadosDia(hoy) === baseEnviadosHoy + 1, `${countSeguimientosEnviadosDia(hoy)} vs ${baseEnviadosHoy + 1}`);
const p2 = getSeguimientoPendiente();
check("siguiente pendiente = B", p2?.conversation_id === B.id, String(p2?.conversation_id));

// 6) Detener: los pendientes pasan a omitido (B), no quedan pendientes de mis leads.
const detenidos = omitirSeguimientosPendientes();
check("detener omite ≥1 pendiente", detenidos >= 1, String(detenidos));
const restante = getSeguimientoPendiente();
check("tras detener no queda B pendiente", restante?.conversation_id !== B.id);

// 7) Stats consistentes (enviados ≥ 1, omitidos ≥ 1 tras lo anterior).
const stats = getSeguimientoStats(hoy);
check("stats.enviados ≥ 1", stats.enviados >= 1, String(stats.enviados));
check("stats.omitidos ≥ 1", stats.omitidos >= 1, String(stats.omitidos));

// 8) Plantillas: GENÉRICAS (sin nombre/alumno, porque de los leads no lo sabemos).
const mMeta = personalizarMensaje(MENSAJE_META_DEFAULT, "Ana", "Sofía");
check("Meta menciona $18.000", mMeta.includes("$18.000"));
check("Meta menciona antes $25.000", mMeta.includes("$25.000"));
check("Meta menciona Arteluk", mMeta.includes("Arteluk"));
check("Meta NO mete nombres (genérico)", !mMeta.includes("Ana") && !mMeta.includes("{nombre}") && !mMeta.includes("{alumno}"));
const mSeg = personalizarMensaje(MENSAJE_SEGUIMIENTO_DEFAULT, "Ana", "Sofía");
check("Seguimiento menciona Arteluk y sin nombres", mSeg.includes("Arteluk") && !mSeg.includes("Ana") && !mSeg.includes("{alumno}"));

// 9) Ya contactado: si el lead tiene un mensaje SALIENTE, sale de los candidatos.
insertMessage(C.id, "human", "hola, te escribo");
check("Meta EXCLUYE al lead ya contactado (C)", !getLeadsMeta().map(l => l.id).includes(C.id));
insertMessage(B.id, "human", "hola");
check("Seguimiento EXCLUYE al cerrado ya contactado (B)", !getLeadsSeguimiento().map(l => l.id).includes(B.id));

// Limpieza: borra seguimientos, mensajes y las conversaciones de prueba.
raw.prepare(`DELETE FROM seguimientos WHERE conversation_id IN (${ids.join(",")})`).run();
raw.prepare(`DELETE FROM messages WHERE conversation_id IN (${ids.join(",")})`).run();
for (const id of ids) deleteConversation(id);
raw.close();

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
