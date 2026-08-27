// PASO 4 del CRM: la MENSUALIDAD de cada alumno, mes a mes (Lukas, 26-08-2026).
//
// La regla del negocio está escrita en el cerebro del bot (prompts/negocio.md):
//   "Los pagos son mensuales y se hacen dentro de los primeros 10 días de cada mes,
//    exclusivamente por transferencia electrónica."
// Por eso el día 10 es la frontera entre "todavía no le toca" y "va atrasado". Antes
// del 11 nadie está atrasado, aunque no haya pagado.
//
// Las tres cosas que aquí NO se pueden mezclar (es el mismo error que ya costó caro
// con asistencia vs ausencias):
//   · alumnos.mensualidad = lo que se le cobra SIEMPRE (su plan).
//   · mensualidades       = lo que pasó con UN mes concreto (pagó, cuánto, cuándo).
//   · ausencias tipo mes  = Mary avisó que ese mes no viene ⇒ ESE MES NO SE LE COBRA.
// Un alumno avisado que apareciera como deudor sería un cobro inventado.
//
// 🔑 El "hoy" entra SIEMPRE por parámetro. Un estado que dependa del reloj de adentro
// no se puede probar y miente en cuanto cambia el mes.
//
// Correr con: npm run test:mensualidades

import "./env-loader.js";
import {
  addAlumno, deleteAlumno, listAlumnos, addInscripcion,
  avisarAusencia,
  getMensualidad, listMensualidadesDeMes, marcarPago, quitarPago,
} from "../src/lib/db.js";
import { estadoDelMes, resumenDelMes, DIA_LIMITE_PAGO } from "../src/lib/mensualidades.js";
import { fichasDelMes } from "../src/lib/crm-alumnos.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const T = "ZZTest ";
function limpiar() { for (const a of listAlumnos()) if (a.nombre.startsWith(T)) deleteAlumno(a.id); }

console.log("\n🧪 TEST mensualidades (el paso 4 del CRM)\n");
limpiar();

const MES = "2026-09";
const DENTRO = "2026-09-05";   // dentro de los 10 primeros días
const PASADO = "2026-09-22";   // ya pasó el plazo
const ANTES = "2026-08-30";    // el mes ni siquiera empezó

console.log("1) La frontera del día 10, que es la regla escrita del negocio");
check("el límite es el día 10", DIA_LIMITE_PAGO === 10, `es ${DIA_LIMITE_PAGO}`);
check(
  "sin pagar y dentro de los 10 días = pendiente, NO atrasado",
  estadoDelMes({ mes: MES, hoy: DENTRO, mensualidadBase: 60000, fila: null, noVieneEsteMes: false }).estado === "pendiente"
);
check(
  "el día 10 todavía es pendiente (el plazo incluye el 10)",
  estadoDelMes({ mes: MES, hoy: "2026-09-10", mensualidadBase: 60000, fila: null, noVieneEsteMes: false }).estado === "pendiente"
);
check(
  "el día 11 ya es atrasado",
  estadoDelMes({ mes: MES, hoy: "2026-09-11", mensualidadBase: 60000, fila: null, noVieneEsteMes: false }).estado === "atrasado"
);
check(
  "un mes que todavía no empieza NUNCA está atrasado",
  estadoDelMes({ mes: MES, hoy: ANTES, mensualidadBase: 60000, fila: null, noVieneEsteMes: false }).estado === "pendiente"
);
check(
  "un mes ya terminado y sin pagar es atrasado",
  estadoDelMes({ mes: MES, hoy: "2026-10-01", mensualidadBase: 60000, fila: null, noVieneEsteMes: false }).estado === "atrasado"
);

console.log("\n2) Quien AVISÓ que no viene ese mes no debe plata (lo más importante)");
const avisado = estadoDelMes({ mes: MES, hoy: PASADO, mensualidadBase: 60000, fila: null, noVieneEsteMes: true });
check("estado 'no_cobra', no atrasado", avisado.estado === "no_cobra", avisado.estado);
check("no se le cobra nada", avisado.monto === 0 && avisado.falta === 0);
check(
  "pero si YA había pagado ese mes, sigue pagado (no se le borra la plata)",
  estadoDelMes({
    mes: MES, hoy: PASADO, mensualidadBase: 60000, noVieneEsteMes: true,
    fila: { alumno_id: 1, mes: MES, monto: 60000, pagado: 60000, estado: "pagado", fecha: `${MES}-03`, comprobante_id: null, ingreso_id: null, nota: null },
  }).estado === "pagado"
);

console.log("\n3) Pagado, a medias y sin monto");
check(
  "pagó completo = pagado y no falta nada",
  (() => {
    const r = estadoDelMes({
      mes: MES, hoy: PASADO, mensualidadBase: 60000, noVieneEsteMes: false,
      fila: { alumno_id: 1, mes: MES, monto: 60000, pagado: 60000, estado: "pagado", fecha: `${MES}-03`, comprobante_id: 7, ingreso_id: 9, nota: null },
    });
    return r.estado === "pagado" && r.falta === 0 && r.comprobanteId === 7;
  })()
);
check(
  "pagó de menos = parcial, y dice cuánto falta",
  (() => {
    const r = estadoDelMes({
      mes: MES, hoy: PASADO, mensualidadBase: 60000, noVieneEsteMes: false,
      fila: { alumno_id: 1, mes: MES, monto: 60000, pagado: 20000, estado: "pendiente", fecha: `${MES}-03`, comprobante_id: null, ingreso_id: null, nota: null },
    });
    return r.estado === "parcial" && r.falta === 40000;
  })()
);
check(
  "pagó de MÁS igual cuenta como pagado, sin falta negativa",
  (() => {
    const r = estadoDelMes({
      mes: MES, hoy: PASADO, mensualidadBase: 60000, noVieneEsteMes: false,
      fila: { alumno_id: 1, mes: MES, monto: 60000, pagado: 75000, estado: "pagado", fecha: `${MES}-03`, comprobante_id: null, ingreso_id: null, nota: null },
    });
    return r.estado === "pagado" && r.falta === 0;
  })()
);
check(
  "sin mensualidad cargada (los 20 alumnos sin monto de la planilla) = sin_monto, jamás atrasado",
  estadoDelMes({ mes: MES, hoy: PASADO, mensualidadBase: 0, fila: null, noVieneEsteMes: false }).estado === "sin_monto"
);
check(
  "el monto del mes manda sobre el plan: si Mary le cobró otra cosa ese mes, vale lo del mes",
  estadoDelMes({
    mes: MES, hoy: PASADO, mensualidadBase: 60000, noVieneEsteMes: false,
    fila: { alumno_id: 1, mes: MES, monto: 45000, pagado: 45000, estado: "pagado", fecha: `${MES}-03`, comprobante_id: null, ingreso_id: null, nota: null },
  }).monto === 45000
);

console.log("\n4) La base guarda el pago del mes, sin duplicar filas");
const ana = addAlumno({ nombre: `${T}Ana`, mensualidad: 60000, telefono: "+56911110001" });
addInscripcion({ alumnoId: ana, dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary" });
const beto = addAlumno({ nombre: `${T}Beto`, mensualidad: 120000, telefono: "+56911110002" });
addInscripcion({ alumnoId: beto, dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: "Paula" });
const cami = addAlumno({ nombre: `${T}Cami`, mensualidad: 45000, telefono: "+56911110003" });
addInscripcion({ alumnoId: cami, dia: "Martes", hora: "17:30", horaFin: "18:30", profe: "Mary" });

check("un alumno sin pago todavía no tiene fila", getMensualidad(ana, MES) === null);

marcarPago({ alumnoId: ana, mes: MES, pagado: 60000, fecha: `${MES}-04` });
const f1 = getMensualidad(ana, MES);
check("queda guardado lo que pagó", f1?.pagado === 60000 && f1?.estado === "pagado", JSON.stringify(f1));
check("el monto esperado se copia de su plan si no se dice otro", f1?.monto === 60000, JSON.stringify(f1));

marcarPago({ alumnoId: ana, mes: MES, pagado: 60000, fecha: `${MES}-04` });
check(
  "marcar dos veces NO crea dos filas (un doble toque no cobra doble)",
  listMensualidadesDeMes(MES).filter((m) => m.alumno_id === ana).length === 1
);

marcarPago({ alumnoId: beto, mes: MES, pagado: 50000, fecha: `${MES}-06`, nota: "abono" });
const f2 = getMensualidad(beto, MES);
check("un abono queda pendiente, no pagado", f2?.estado === "pendiente" && f2?.pagado === 50000, JSON.stringify(f2));

check(
  "el pago de un mes no se mete en otro",
  getMensualidad(ana, "2026-10") === null && listMensualidadesDeMes("2026-10").length === 0
);

quitarPago(ana, MES);
check("se puede deshacer (Mary se equivocó de alumno)", getMensualidad(ana, MES) === null);

console.log("\n5) El CRM del mes muestra el pago de cada uno");
marcarPago({ alumnoId: ana, mes: MES, pagado: 60000, fecha: `${MES}-04` });
avisarAusencia({ alumnoId: cami, tipo: "mes", mes: MES, motivo: "viaje" });

const fichas = fichasDelMes(MES).filter((f) => f.nombre.startsWith(T));
const fAna = fichas.find((f) => f.nombre === `${T}Ana`);
const fBeto = fichas.find((f) => f.nombre === `${T}Beto`);
const fCami = fichas.find((f) => f.nombre === `${T}Cami`);
check("la ficha trae el pago del mes", !!fAna?.pago, JSON.stringify(fAna?.pago));
check("la que pagó sale pagada", fAna?.pago.estado === "pagado", fAna?.pago.estado);
check("el que abonó sale parcial y con lo que falta", fBeto?.pago.estado === "parcial" && fBeto?.pago.falta === 70000, JSON.stringify(fBeto?.pago));
check("la que no viene este mes NO aparece debiendo", fCami?.pago.estado === "no_cobra", fCami?.pago.estado);

console.log("\n6) El resumen de arriba (lo que Mary mira de una)");
const soloTest = fichasDelMes(MES).filter((f) => f.nombre.startsWith(T));
const r = resumenDelMes(soloTest);
check("cuenta lo cobrado del mes", r.cobrado === 110000, JSON.stringify(r));
check("cuenta lo que falta por cobrar", r.porCobrar === 70000, JSON.stringify(r));
check("cuenta cuántos deben", r.deben === 1, JSON.stringify(r));
check("no cuenta a los que no vienen ese mes", r.noCobra === 1, JSON.stringify(r));

console.log("\n7) El mes anterior no se contamina con lo de este");
const fichasAgosto = fichasDelMes("2026-08").filter((f) => f.nombre.startsWith(T));
check(
  "en agosto nadie pagó (el pago era de septiembre)",
  fichasAgosto.every((f) => f.pago.estado !== "pagado"),
  JSON.stringify(fichasAgosto.map((f) => [f.nombre, f.pago.estado]))
);
check(
  "y la ausencia de septiembre tampoco pinta agosto",
  fichasAgosto.find((f) => f.nombre === `${T}Cami`)?.pago.estado !== "no_cobra"
);

limpiar();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
