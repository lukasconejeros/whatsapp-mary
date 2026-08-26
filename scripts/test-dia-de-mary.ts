// armarDia(): todo lo que Mary tiene una fecha concreta, que es lo que le llega
// a las 10:00, más la lista de alumnos que se le preguntará a las 21:00.
//
// Crea datos de prueba en 2099 y los borra SIEMPRE (try/finally): una clase fija
// o un pago fijo olvidado aparecería en el calendario de verdad todas las
// semanas o todos los meses.
import "./env-loader.js";
import {
  addClaseFija, deleteClaseFija, addClase, deleteClase,
  addRecordatorio, deleteRecordatorio, addPagoFijo, deletePagoFijo,
  listClientes, addAlumno, addInscripcion, deleteAlumno, avisarAusencia,
} from "../src/lib/db.js";
import { armarDia } from "../src/lib/dia-de-mary.js";
import { diaFromFecha } from "../src/lib/calendario.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const F = "2099-01-05";      // el día con cosas
const VACIO = "2099-01-08";  // un día sin nada
const DIA = diaFromFecha(F);

const creados = { fijas: [] as number[], clases: [] as number[], recs: [] as number[], pagos: [] as number[], alumnos: [] as number[] };

try {
  // Un cliente REAL de la base para probar que los ids se traducen a nombre.
  const cliente = listClientes().find((c) => (c.nombre ?? "").trim().length > 0);
  // La base de trabajo puede tener clases fijas y pagos de verdad ese día de la
  // semana: se mide el ANTES y se comparan diferencias, no totales absolutos.
  const base = armarDia(F);

  creados.fijas.push(addClaseFija({ dia: DIA, hora: "16:00", profe: "Mary", alumnos: ["Mateo PRUEBA", "Matilda PRUEBA"] }));
  creados.clases.push(addClase({ fecha: F, dia: DIA, profe: "Paula", hora: "18:00", alumnos: cliente ? [cliente.id] : ["Sofia PRUEBA"] }));
  creados.clases.push(addClase({ fecha: F, dia: DIA, profe: "Mary", nota: "PRUEBA revisar el horno" }));
  creados.recs.push(addRecordatorio({ fecha: F, hora: "09:00", texto: "PRUEBA comprar arcilla" }));
  creados.pagos.push(addPagoFijo({ tipo: "arriendo", monto: 350000, diaMes: 5 }));

  const dia = armarDia(F);

  console.log("Lo que hay ese día");
  check("suma las 5 cosas nuevas", dia.items.length === base.items.length + 5, JSON.stringify(dia.items));
  // Invariante del orden: por hora ascendente y lo que no tiene hora, al final.
  const min = (h: string | null) => (h === null ? 99999 : Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)));
  const ordenado = dia.items.every((it, i) => i === 0 || min(dia.items[i - 1].hora) <= min(it.hora));
  check("va ordenado por hora, y lo sin hora al final", ordenado, JSON.stringify(dia.items.map((i) => i.hora)));
  check("el recordatorio de las 09:00 está", dia.items.some((i) => i.tipo === "recordatorio" && i.hora === "09:00" && i.texto.includes("comprar arcilla")));
  check("la clase fija de las 16:00 está", dia.items.some((i) => i.tipo === "clase" && i.hora === "16:00" && i.texto.includes("Mateo PRUEBA")));
  check("el evento de las 18:00 está", dia.items.some((i) => i.tipo === "clase" && i.hora === "18:00"));
  check("el pago aparece con su monto", dia.items.some((i) => i.tipo === "pago" && i.texto.includes("350")), JSON.stringify(dia.items.filter((i) => i.tipo === "pago")));
  check("la nota suelta aparece sin hora", dia.items.some((i) => i.hora === null && i.texto.includes("revisar el horno")));

  console.log("\nLos alumnos del día");
  const esperado = cliente?.nombre?.trim() ?? "Sofia PRUEBA";
  check("están los de la clase fija", dia.alumnos.includes("Mateo PRUEBA") && dia.alumnos.includes("Matilda PRUEBA"), JSON.stringify(dia.alumnos));
  check("y el del evento, con su nombre y no su número", dia.alumnos.includes(esperado), JSON.stringify(dia.alumnos));
  check("la nota suelta no aporta alumnos", dia.alumnos.length === base.alumnos.length + 3, JSON.stringify(dia.alumnos));

  // El mismo niño en dos clases del día: se pregunta UNA vez.
  creados.fijas.push(addClaseFija({ dia: DIA, hora: "19:00", profe: "Mary", alumnos: ["Mateo PRUEBA"] }));
  const dia2 = armarDia(F);
  check("un alumno en dos clases no se repite", dia2.alumnos.filter((a) => a === "Mateo PRUEBA").length === 1, JSON.stringify(dia2.alumnos));
  check("pero la clase sí aparece", dia2.items.length === base.items.length + 6);

  // ── El horario de verdad: alumnos con inscripción (26-08-2026) ──────────────
  // Desde que el horario de Mary vive en 'inscripciones', el resumen de las 10:00 y
  // el pase de lista de las 21:00 tienen que salir de ahí. Y a quien avisó que no
  // viene NO se le pregunta: saldría "faltó" todas las semanas del mes.
  console.log("\nLos alumnos inscritos (el horario nuevo)");
  const inA = addAlumno({ nombre: "ZZPrueba Ana" });
  creados.alumnos.push(inA);
  addInscripcion({ alumnoId: inA, dia: DIA, hora: "17:30", horaFin: "19:30", profe: "Mary" });
  const inB = addAlumno({ nombre: "ZZPrueba Bea" });
  creados.alumnos.push(inB);
  addInscripcion({ alumnoId: inB, dia: DIA, hora: "17:30", horaFin: "18:30", profe: "Mary" });

  const conInscritas = armarDia(F);
  check("las inscripciones aparecen en el día", conInscritas.items.some((i) => i.tipo === "clase" && i.texto.includes("ZZPrueba Ana")), JSON.stringify(conInscritas.items));
  check("y se les pasa lista a las dos", conInscritas.alumnos.includes("ZZPrueba Ana") && conInscritas.alumnos.includes("ZZPrueba Bea"));

  avisarAusencia({ alumnoId: inA, tipo: "dia", fecha: F, motivo: "al médico" });
  const conAviso = armarDia(F);
  check("a quien avisó ese día NO se le pasa lista", !conAviso.alumnos.includes("ZZPrueba Ana"), JSON.stringify(conAviso.alumnos));
  check("pero a la otra sí", conAviso.alumnos.includes("ZZPrueba Bea"));
  check("y la clase sigue apareciendo, con el aviso a la vista", conAviso.items.some((i) => i.texto.includes("ZZPrueba Ana") && i.texto.includes("no viene")), JSON.stringify(conAviso.items.filter((i) => i.tipo === "clase")));

  avisarAusencia({ alumnoId: inB, tipo: "mes", mes: F.slice(0, 7) });
  const sinNadie = armarDia(F);
  check("la que no viene en todo el mes tampoco entra al pase de lista", !sinNadie.alumnos.includes("ZZPrueba Bea"), JSON.stringify(sinNadie.alumnos));

  console.log("\nUn día sin nada");
  const nada = armarDia(VACIO);
  check("no trae nada de la prueba", nada.items.every((i) => !i.texto.includes("PRUEBA")), JSON.stringify(nada.items));
  check("ni sus alumnos", nada.alumnos.every((a) => !a.includes("PRUEBA")), JSON.stringify(nada.alumnos));
} finally {
  for (const id of creados.fijas) deleteClaseFija(id);
  for (const id of creados.clases) deleteClase(id);
  for (const id of creados.recs) deleteRecordatorio(id);
  for (const id of creados.pagos) deletePagoFijo(id);
  // deleteAlumno se lleva también sus inscripciones y sus avisos.
  for (const id of creados.alumnos) deleteAlumno(id);
  const limpio = armarDia(F);
  check("limpieza: no queda nada de prueba", limpio.items.every((i) => !i.texto.includes("PRUEBA")), JSON.stringify(limpio.items));
}

console.log(`\n${pass} bien, ${fail} mal`);
process.exit(fail === 0 ? 0 : 1);
