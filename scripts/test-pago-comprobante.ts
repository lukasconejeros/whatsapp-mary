// El enganche CONTRA LA BASE: la foto de la transferencia se convierte en el mes
// pagado del alumno que corresponde (paso 4 del CRM, Lukas 26-08-2026).
//
// El test de al lado (test:pago-alumno) prueba a quién se le propone. Este prueba lo
// que pasa cuando Mary aprieta Aprobar: que el ingreso siga naciendo como siempre y
// que, además, quede marcada la mensualidad del alumno correcto — sin cobrar dos veces
// si toca el botón dos veces, y sin tocar nada si ella no eligió a nadie.
//
// Corre contra la DB local con un teléfono reservado (5699000803X) y limpia SOLO sus
// propias filas: la tabla tiene trabajo real de Mary.
//
// Correr con: npm run test:pago-comprobante

import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import {
  getOrCreateConversation, deleteConversation,
  addBorradorComprobante, aprobarBorradorComprobante,
  addAlumno, deleteAlumno, listAlumnos,
  getMensualidad, avisarAusencia,
  listIngresos, deleteIngreso,
} from "../src/lib/db.js";
import { propuestaDeComprobante } from "../src/lib/crm-alumnos.js";

const TEL_CASA = "56990008031";   // la casa de las dos hermanas
const TEL_SOLA = "56990008032";   // una alumna sola
const FECHA = "2026-09-03";
const MES = "2026-09";
const T = "ZZPago ";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

// ── Limpieza acotada ──────────────────────────────────────────────────────────
const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
function limpiar() {
  for (const tel of [TEL_CASA, TEL_SOLA]) {
    const c = raw.prepare("SELECT id FROM conversations WHERE phone = ?").get(tel) as { id: number } | undefined;
    if (c) {
      try { raw.prepare("DELETE FROM comprobantes WHERE conversation_id = ?").run(c.id); } catch { /* aún no existe */ }
      deleteConversation(c.id);
    }
  }
  for (const i of listIngresos(MES)) if ((i.detalle ?? "").includes("TEST-ENGANCHE")) deleteIngreso(i.id);
  for (const a of listAlumnos()) if (a.nombre.startsWith(T)) deleteAlumno(a.id);
}
limpiar();

console.log("\n🧪 TEST del enganche comprobante → mensualidad\n");

const convCasa = getOrCreateConversation(TEL_CASA, "Judith de Prueba");
const convSola = getOrCreateConversation(TEL_SOLA, "Carla de Prueba");

const hermana1 = addAlumno({ nombre: `${T}Amparo`, apoderado: "Judith de Prueba", telefono: TEL_CASA, mensualidad: 60000 });
const hermana2 = addAlumno({ nombre: `${T}Amelia`, apoderado: "Judith de Prueba", telefono: TEL_CASA, mensualidad: 75000 });
const sola = addAlumno({ nombre: `${T}Sofia`, apoderado: "Carla de Prueba", telefono: TEL_SOLA, mensualidad: 60000 });

function borrador(convId: number, monto: number, nombre = "Titular de Prueba"): number {
  return addBorradorComprobante({
    conversationId: convId, media: null, monto, fecha: FECHA,
    nombre, banco: "BancoEstado", esperado: true, deMeta: false,
  });
}

console.log("1) La propuesta sale de los datos de verdad, no de un supuesto");
{
  const id = borrador(convSola.id, 60000);
  const p = propuestaDeComprobante(id);
  check("propone a la alumna de ese teléfono", p?.elegido?.alumnoIds.join() === String(sola), JSON.stringify(p?.elegido));
  check("y propone el mes de la fecha del pago", p?.mes === MES, String(p?.mes));
  check("trae el monto y el titular leídos de la foto", p?.monto === 60000 && p?.titular === "Titular de Prueba", JSON.stringify([p?.monto, p?.titular]));
}
{
  const id = borrador(convCasa.id, 75000);
  const p = propuestaDeComprobante(id);
  check("entre hermanas, el monto elige a la que corresponde", p?.elegido?.alumnoIds.join() === String(hermana2), JSON.stringify(p?.elegido));
  check("y ofrece igual a la otra hermana", p?.candidatos.some((c) => c.alumnoIds.join() === String(hermana1)) === true);
}
check("un comprobante que no existe no revienta", propuestaDeComprobante(999999) === null);

console.log("\n2) Aprobar con alumno: nace el ingreso Y queda pagada su mensualidad");
{
  const id = borrador(convSola.id, 60000);
  const ingresoId = aprobarBorradorComprobante(id, {
    detalle: "TEST-ENGANCHE", alumnoIds: [sola], mes: MES,
  });
  check("el ingreso se creó como siempre", typeof ingresoId === "number" && ingresoId! > 0, String(ingresoId));
  const m = getMensualidad(sola, MES);
  check("su mensualidad quedó pagada", m?.estado === "pagado", JSON.stringify(m));
  check("con lo que de verdad transfirió", m?.pagado === 60000, JSON.stringify(m));
  check("y guarda de qué comprobante salió", m?.comprobante_id === id, JSON.stringify(m));
  check("y de qué ingreso", m?.ingreso_id === ingresoId, JSON.stringify(m));
}

console.log("\n3) Dos toques al botón NO cobran dos veces");
{
  const id = borrador(convSola.id, 60000);
  const antes = getMensualidad(sola, MES)?.pagado ?? 0;
  aprobarBorradorComprobante(id, { detalle: "TEST-ENGANCHE", alumnoIds: [sola], mes: MES });
  const unaVez = getMensualidad(sola, MES)?.pagado ?? 0;
  aprobarBorradorComprobante(id, { detalle: "TEST-ENGANCHE", alumnoIds: [sola], mes: MES });
  const dosVeces = getMensualidad(sola, MES)?.pagado ?? 0;
  check("el segundo toque deja el mismo pagado", unaVez === dosVeces, `${unaVez} vs ${dosVeces}`);
  check("un comprobante nuevo SÍ suma sobre lo anterior", unaVez === antes + 60000, `${antes} → ${unaVez}`);
}

console.log("\n4) Un pago que cubre a las dos hermanas se reparte por su mensualidad");
{
  const id = borrador(convCasa.id, 135000);
  aprobarBorradorComprobante(id, { detalle: "TEST-ENGANCHE", alumnoIds: [hermana1, hermana2], mes: MES });
  const m1 = getMensualidad(hermana1, MES), m2 = getMensualidad(hermana2, MES);
  check("a cada una LO SUYO, no la mitad para cada una", m1?.pagado === 60000 && m2?.pagado === 75000, JSON.stringify([m1?.pagado, m2?.pagado]));
  check("las dos quedan pagadas", m1?.estado === "pagado" && m2?.estado === "pagado", JSON.stringify([m1?.estado, m2?.estado]));
}

console.log("\n5) Lo de siempre no se rompe: sin alumno elegido, solo el ingreso");
{
  const nadie = addAlumno({ nombre: `${T}Nadie`, apoderado: null, telefono: "56990008039", mensualidad: 60000 });
  const id = borrador(convSola.id, 20000);
  const ingresoId = aprobarBorradorComprobante(id, { detalle: "TEST-ENGANCHE" });
  check("el ingreso se crea igual que antes del enganche", typeof ingresoId === "number" && ingresoId! > 0);
  check("y no se le inventa el pago a nadie", getMensualidad(nadie, MES) === null, JSON.stringify(getMensualidad(nadie, MES)));
  deleteAlumno(nadie);
}

console.log("\n6) El monto que Mary corrige a mano es el que se cobra");
{
  const otra = addAlumno({ nombre: `${T}Corregida`, apoderado: null, telefono: "56990008038", mensualidad: 60000 });
  const id = borrador(convSola.id, 6000); // el modelo leyó mal: le faltó un cero
  aprobarBorradorComprobante(id, { detalle: "TEST-ENGANCHE", monto: 60000, alumnoIds: [otra], mes: MES });
  const m = getMensualidad(otra, MES);
  check("se guarda el monto corregido, no el leído", m?.pagado === 60000, JSON.stringify(m));
  deleteAlumno(otra);
}

console.log("\n7) Un abono parcial deja la deuda a medias, no pagada");
{
  const abona = addAlumno({ nombre: `${T}Abona`, apoderado: null, telefono: "56990008037", mensualidad: 60000 });
  aprobarBorradorComprobante(borrador(convSola.id, 30000), { detalle: "TEST-ENGANCHE", alumnoIds: [abona], mes: MES });
  const m1 = getMensualidad(abona, MES);
  check("con la mitad, sigue pendiente", m1?.estado === "pendiente" && m1?.pagado === 30000, JSON.stringify(m1));
  aprobarBorradorComprobante(borrador(convSola.id, 30000), { detalle: "TEST-ENGANCHE", alumnoIds: [abona], mes: MES });
  const m2 = getMensualidad(abona, MES);
  check("el segundo abono la completa", m2?.estado === "pagado" && m2?.pagado === 60000, JSON.stringify(m2));
  deleteAlumno(abona);
}

console.log("\n8) Quien avisó que no viene ese mes NO queda elegido solo");
{
  const fuera = addAlumno({ nombre: `${T}Fuera`, apoderado: null, telefono: TEL_SOLA, mensualidad: 60000 });
  avisarAusencia({ alumnoId: fuera, tipo: "mes", mes: MES, motivo: "viaje" });
  const p = propuestaDeComprobante(borrador(convSola.id, 60000));
  const suyo = p?.candidatos.find((c) => c.alumnoIds.join() === String(fuera));
  check("se ofrece igual (la plata llegó)", suyo !== undefined, JSON.stringify(p?.candidatos));
  check("con el aviso a la vista", suyo?.avisos.some((a) => /no viene/i.test(a)) === true, JSON.stringify(suyo?.avisos));
  deleteAlumno(fuera);
}

limpiar();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
