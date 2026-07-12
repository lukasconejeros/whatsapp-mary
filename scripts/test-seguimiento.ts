import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import {
  getOrCreateConversation,
  setCategoria,
  setCerrado,
  getLeadsParaSeguimiento,
  enqueueSeguimientos,
  getSeguimientoPendiente,
  markSeguimientoEnviado,
  countSeguimientosEnviadosDia,
  getSeguimientoStats,
  omitirSeguimientosPendientes,
  deleteConversation,
} from "../src/lib/db.js";
import { todaySantiago } from "../src/lib/fechas.js";
import { mensajeSeguimientoFallback } from "../src/lib/seguimiento.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST campaña de seguimiento (cola + tope + anti-baneo)\n");

const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
const hoy = todaySantiago();

// 3 leads de prueba: A y B = Meta abiertos (candidatos), C = Meta cerrado (excluido).
const A = getOrCreateConversation("56900000SEGA", "Lead A");
const B = getOrCreateConversation("56900000SEGB", "Lead B");
const C = getOrCreateConversation("56900000SEGC", "Lead C");
for (const c of [A, B, C]) setCategoria(c.id, "potencial", true);
setCerrado(C.id, true);
const ids = [A.id, B.id, C.id];
raw.prepare(`DELETE FROM seguimientos WHERE conversation_id IN (${ids.join(",")})`).run();
const baseEnviadosHoy = countSeguimientosEnviadosDia(hoy);

// 1) Candidatos: incluye A y B (Meta abiertos), excluye C (cerrado).
const cand = getLeadsParaSeguimiento().map(l => l.id);
check("candidato incluye lead abierto A", cand.includes(A.id));
check("candidato incluye lead abierto B", cand.includes(B.id));
check("candidato EXCLUYE lead cerrado C", !cand.includes(C.id));

// 2) Encolar: agrega A y B (2), no C.
const items = getLeadsParaSeguimiento().filter(l => ids.includes(l.id)).map(l => ({ id: l.id, phone: l.phone }));
const agregados = enqueueSeguimientos(items);
check("encola 2 (A y B, no el cerrado)", agregados === 2, String(agregados));

// 3) Dedup: reencolar no agrega nada (ya tienen pendiente).
check("reencolar no duplica (0)", enqueueSeguimientos(items) === 0);

// 4) FIFO: el pendiente más antiguo sale primero (A antes que B).
const p1 = getSeguimientoPendiente();
check("pendiente FIFO = A primero", p1?.conversation_id === A.id, String(p1?.conversation_id));

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

// 8) Mensaje fallback lleva la promo y la marca.
const m = mensajeSeguimientoFallback("Ana", "Sofía");
check("mensaje menciona $18.000", m.includes("$18.000"));
check("mensaje menciona antes $25.000", m.includes("$25.000"));
check("mensaje personaliza (Ana y Sofía)", m.includes("Ana") && m.includes("Sofía"));
check("mensaje firma Arteluk", m.includes("Arteluk"));

// Limpieza: borra seguimientos de prueba y las conversaciones.
raw.prepare(`DELETE FROM seguimientos WHERE conversation_id IN (${ids.join(",")})`).run();
for (const id of ids) deleteConversation(id);
raw.close();

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
