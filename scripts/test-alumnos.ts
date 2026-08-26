// Los ALUMNOS de la academia y sus INSCRIPCIONES (26-08-2026).
//
// Lukas mandó las 9 fotos del Excel de su mamá: 6 días, 2 profesoras, 44 inscripciones.
// El hallazgo que obliga a este modelo nuevo: DENTRO DE LA MISMA SALA cada alumno tiene
// SU PROPIA hora de salida (el jueves uno se queda hasta 19:30 y cuatro hasta 18:30).
// El modelo viejo (clases_fijas = un bloque con una lista de nombres, todos a la misma
// hora) partiría cada día en 2-3 "clases" falsas.
//
// Correr con: npm run test:alumnos

import "./env-loader.js";
import {
  addAlumno,
  getAlumno,
  listAlumnos,
  updateAlumno,
  deleteAlumno,
  addInscripcion,
  listInscripciones,
  updateInscripcion,
  deleteInscripcion,
  inscripcionesDeFecha,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

// Marca para no tocar NUNCA los alumnos de verdad de Mary.
const T = "ZZTest ";
function limpiar() {
  for (const a of listAlumnos()) if (a.nombre.startsWith(T)) deleteAlumno(a.id);
}

console.log("\n🧪 TEST alumnos e inscripciones (el horario de Mary)\n");
limpiar();

// 1) La ficha del alumno: es el CRM, con su mensualidad y su apoderado.
const mateo = addAlumno({
  nombre: `${T}Mateo`, apoderado: "Mamá de Mateo", telefono: "+56911111111",
  mensualidad: 45000,
});
const ficha = getAlumno(mateo);
check("se guarda la ficha del alumno", !!ficha);
check("guarda el apoderado y su teléfono", ficha?.apoderado === "Mamá de Mateo" && ficha?.telefono === "+56911111111", `${ficha?.apoderado}/${ficha?.telefono}`);
check("guarda la mensualidad", ficha?.mensualidad === 45000, String(ficha?.mensualidad));
check("nace activo", ficha?.activo === true);
check("nace sin marca de revisar", ficha?.revisar === null, String(ficha?.revisar));

// 2) UN alumno que viene DOS días es UNA sola ficha con dos inscripciones
//    (Mateo está el lunes y el martes en la planilla real).
const insLunes = addInscripcion({ alumnoId: mateo, dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary" });
const insMartes = addInscripcion({ alumnoId: mateo, dia: "Martes", hora: "17:30", horaFin: "19:30", profe: "Mary" });
check("las dos inscripciones cuelgan del mismo alumno", listInscripciones(mateo).length === 2, String(listInscripciones(mateo).length));
check("sigue habiendo una sola ficha", listAlumnos().filter((a) => a.nombre === `${T}Mateo`).length === 1);

// 3) 🔑 EL HALLAZGO: misma sala, misma hora de entrada, DISTINTA hora de salida.
//    Jueves real: Barbara hasta 19:30 y diego/Amanda hasta 18:30.
const barbara = addAlumno({ nombre: `${T}Barbara`, mensualidad: 60000 });
const diego = addAlumno({ nombre: `${T}diego`, mensualidad: 60000 });
addInscripcion({ alumnoId: barbara, dia: "Jueves", hora: "17:30", horaFin: "19:30", profe: "Mary" });
addInscripcion({ alumnoId: diego, dia: "Jueves", hora: "17:30", horaFin: "18:30", profe: "Mary" });
// 27-08-2026 es jueves.
const jueves = inscripcionesDeFecha("2026-08-27").filter((i) => i.nombre.startsWith(T));
check("los dos aparecen el jueves", jueves.length === 2, String(jueves.length));
check("cada uno con SU hora de salida", jueves.find((i) => i.nombre === `${T}Barbara`)?.horaFin === "19:30" && jueves.find((i) => i.nombre === `${T}diego`)?.horaFin === "18:30",
  JSON.stringify(jueves.map((i) => `${i.nombre}:${i.horaFin}`)));
check("la agenda del día trae el nombre del alumno, no solo su id", typeof jueves[0]?.nombre === "string" && jueves[0].nombre.length > 0);

// 4) Se repite TODAS las semanas y no se cuela en otro día.
const jueves3sep = inscripcionesDeFecha("2026-09-03").filter((i) => i.nombre.startsWith(T));
const viernes28 = inscripcionesDeFecha("2026-08-28").filter((i) => i.nombre.startsWith(T));
check("aparece también el jueves siguiente (se repite)", jueves3sep.length === 2, String(jueves3sep.length));
check("NO aparece el viernes", viernes28.length === 0, String(viernes28.length));

// 5) El lunes salen Mateo y nadie más de la prueba, ordenados por hora.
const amparo = addAlumno({ nombre: `${T}Amparo` });
addInscripcion({ alumnoId: amparo, dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: null });
const lunes = inscripcionesDeFecha("2026-08-31").filter((i) => i.nombre.startsWith(T));
check("el día sale ordenado por hora de entrada", JSON.stringify(lunes.map((i) => i.hora)) === '["16:00","17:30"]', JSON.stringify(lunes.map((i) => i.hora)));

// 6) La foto sin encabezado: 3 alumnas con hora pero SIN DÍA. Se cargan igual (no se
//    pierden), quedan marcadas para preguntarle a Mary y NO ensucian ningún día.
const grace = addAlumno({ nombre: `${T}Grace`, revisar: "falta-dia" });
const sinDia = addInscripcion({ alumnoId: grace, dia: null, hora: "18:30", horaFin: "19:30", profe: null });
check("la marca de revisar queda guardada", getAlumno(grace)?.revisar === "falta-dia", String(getAlumno(grace)?.revisar));
check("la inscripción sin día existe en la ficha", listInscripciones(grace).length === 1);
const todosLosDias = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
check("pero NO aparece en ningún día del calendario", !todosLosDias.some((f) => inscripcionesDeFecha(f).some((i) => i.id === sinDia)));

// 7) Dar de baja: el alumno que se va deja de salir en el calendario pero NO se borra
//    (se perdería su historial de asistencia y sus pagos).
updateAlumno(mateo, { nombre: `${T}Mateo`, mensualidad: 45000, activo: false });
check("el alumno dado de baja NO sale en el calendario", !inscripcionesDeFecha("2026-08-31").some((i) => i.alumnoId === mateo));
check("pero sigue en la lista de administración", listAlumnos().some((a) => a.id === mateo));
updateAlumno(mateo, { nombre: `${T}Mateo`, mensualidad: 45000, activo: true });
check("y vuelve al calendario al reactivarlo", inscripcionesDeFecha("2026-08-31").some((i) => i.alumnoId === mateo));

// 8) Una inscripción se puede dar de baja sola: deja de venir el martes pero sigue el lunes.
updateInscripcion(insMartes, { alumnoId: mateo, dia: "Martes", hora: "17:30", horaFin: "19:30", profe: "Mary", activa: false });
check("el martes ya no aparece", !inscripcionesDeFecha("2026-09-01").some((i) => i.id === insMartes));
check("pero el lunes sigue viniendo", inscripcionesDeFecha("2026-08-31").some((i) => i.id === insLunes));

// 9) Borrar el alumno se lleva sus inscripciones: no quedan huérfanas en el calendario.
deleteInscripcion(insMartes);
check("la inscripción borrada ya no está", listInscripciones(mateo).length === 1, String(listInscripciones(mateo).length));
deleteAlumno(mateo);
check("borrado el alumno, no queda ninguna inscripción suya", listInscripciones(mateo).length === 0, String(listInscripciones(mateo).length));
check("y no aparece más en el calendario", !inscripcionesDeFecha("2026-08-31").some((i) => i.alumnoId === mateo));

// Limpieza: que el test no deje basura en la base de Mary.
limpiar();
check("el test no deja alumnos suyos en la base", !listAlumnos().some((a) => a.nombre.startsWith(T)));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
