// Las tres tablas del pase de lista contra la DB de verdad: avisos_diarios (el
// candado para no repetir el mensaje cada 5 min), pase_lista (a quién se
// preguntó y qué contestó) y asistencia (quién vino y quién no).
//
// Usa fechas de 2099 para no ensuciar nada real, y borra todo lo suyo al final.
import "./env-loader.js";
import {
  getAvisoDiario, marcarAvisoEncolado, marcarAvisoEnviado,
  getPaseLista, abrirPaseLista, cerrarPaseLista, sumarAclaracion,
  marcarAsistencia, asistenciaRango, borrarAsistencia,
  borrarAvisoDiario, borrarPaseLista,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const D1 = "2099-01-05";
const D2 = "2099-01-06";
const D3 = "2099-01-07";

// ── 1) El candado de los avisos ─────────────────────────────────────────────
console.log("Avisos diarios");
check("un día sin aviso no tiene fila", getAvisoDiario(D1, "resumen") === null);

marcarAvisoEncolado(D1, "resumen", 4321);
const a1 = getAvisoDiario(D1, "resumen");
check("al encolar guarda el número de la cola", a1?.outboxId === 4321, JSON.stringify(a1));
check("y NO lo da por enviado", a1?.enviadoAt === null, JSON.stringify(a1));

marcarAvisoEnviado(D1, "resumen");
const a2 = getAvisoDiario(D1, "resumen");
check("cuando WhatsApp confirma, queda enviado", typeof a2?.enviadoAt === "number", JSON.stringify(a2));

marcarAvisoEncolado(D1, "resumen", null);
check("soltarlo borra la cola pero deja el enviado", getAvisoDiario(D1, "resumen")?.outboxId === null);

check("el pase de lista del mismo día es otra fila", getAvisoDiario(D1, "pase-lista") === null);

// ── 2) El pase de lista ─────────────────────────────────────────────────────
console.log("\nPase de lista");
abrirPaseLista(D2, ["Mateo", "Matilda", "Sofía"]);
const p1 = getPaseLista(D2);
check("guarda los alumnos preguntados", JSON.stringify(p1?.alumnos) === JSON.stringify(["Mateo", "Matilda", "Sofía"]), JSON.stringify(p1));
check("nace sin responder", p1?.respondidoAt === null && p1?.respuesta === null, JSON.stringify(p1));
check("nace sin aclaraciones", p1?.aclaraciones === 0);

check("la primera aclaración es la 1", sumarAclaracion(D2) === 1);
check("la segunda es la 2", sumarAclaracion(D2) === 2);

cerrarPaseLista(D2, "no fue Mateo");
const p2 = getPaseLista(D2);
check("al cerrarlo guarda lo que dijo", p2?.respuesta === "no fue Mateo", JSON.stringify(p2));
check("y la hora en que respondió", typeof p2?.respondidoAt === "number");

abrirPaseLista(D2, ["Solo Uno"]);
check("volver a abrir el mismo día no pisa la respuesta", getPaseLista(D2)?.respuesta === "no fue Mateo");

// ── 3) La asistencia ────────────────────────────────────────────────────────
console.log("\nAsistencia");
marcarAsistencia(D1, "Mateo", "falto");
marcarAsistencia(D1, "Matilda", "vino");
check("guarda los dos", asistenciaRango(D1, D1).length === 2);
check("con su estado", asistenciaRango(D1, D1).find((a) => a.alumno === "Mateo")?.estado === "falto");
check("por defecto la fuente es whatsapp", asistenciaRango(D1, D1).find((a) => a.alumno === "Mateo")?.fuente === "whatsapp");

marcarAsistencia(D1, "Mateo", "vino", "panel");
const soloMateo = asistenciaRango(D1, D1).filter((a) => a.alumno === "Mateo");
check("corregir NO duplica la fila", soloMateo.length === 1, JSON.stringify(soloMateo));
check("corregir cambia el estado", soloMateo[0]?.estado === "vino");
check("y deja constancia de que fue a mano", soloMateo[0]?.fuente === "panel");

marcarAsistencia(D3, "Sofía", "falto");
check("el rango trae solo lo pedido", asistenciaRango(D1, D2).every((a) => a.fecha !== D3));
check("y el rango ancho los trae todos", asistenciaRango(D1, D3).length === 3, JSON.stringify(asistenciaRango(D1, D3)));

borrarAsistencia(D1, "Mateo");
check("se puede desmarcar", asistenciaRango(D1, D1).some((a) => a.alumno === "Mateo") === false);

// ── Limpieza ────────────────────────────────────────────────────────────────
for (const f of [D1, D2, D3]) {
  for (const a of asistenciaRango(f, f)) borrarAsistencia(f, a.alumno);
  borrarPaseLista(f);
  borrarAvisoDiario(f, "resumen");
  borrarAvisoDiario(f, "pase-lista");
}
check("limpieza: no queda asistencia de prueba", asistenciaRango(D1, D3).length === 0);
check("limpieza: no queda pase de lista de prueba", getPaseLista(D2) === null);
check("limpieza: no queda aviso de prueba", getAvisoDiario(D1, "resumen") === null);

console.log(`\n${pass} bien, ${fail} mal`);
process.exit(fail === 0 ? 0 : 1);
