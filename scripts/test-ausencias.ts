// El botón "no viene": las AUSENCIAS avisadas y cómo se ve el día (Lukas, 26-08-2026).
//
// Textual suyo, que es la regla completa:
//   "el calendario nunca cambia pero si un mes mi mamá quita a Emilia por ejemplo la
//    borra un lunes, que pregunte la app si no viene en todo el mes o solo ese día, y
//    que si pone que no viene ese mes que se salga del CRM solo ese mes, y si dice que
//    falta ese día que se ponga en gris en el calendario ese día y que en el CRM diga
//    que faltó ese día — eso nos ayuda porque quien falta un día puede optar a una
//    clase recuperatoria"
//
// Dos cosas DISTINTAS que aquí no se pueden mezclar:
//   · asistencia  = lo que PASÓ (lo llena el pase de lista de las 21:00): vino / faltó.
//   · ausencia    = lo que Mary AVISA ANTES: no viene ese día, o no viene ese mes.
// Un alumno con ausencia avisada no se le pregunta en el pase de lista (si no, saldría
// como "faltó" todas las semanas del mes) y sale en gris en el calendario.
//
// Correr con: npm run test:ausencias

import "./env-loader.js";
import {
  addAlumno, addInscripcion, deleteAlumno, listAlumnos,
  avisarAusencia, quitarAusencia, ausenciasRango, ausenciasDeAlumno,
  inscripcionesDeFecha,
} from "../src/lib/db.js";
import { bloquesDelDia, alumnosQueVienen, type InscripcionConAlumno } from "../src/lib/dia-clases.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const T = "ZZTest ";
function limpiar() { for (const a of listAlumnos()) if (a.nombre.startsWith(T)) deleteAlumno(a.id); }

console.log("\n🧪 TEST ausencias avisadas (el botón «no viene»)\n");
limpiar();

// Un lunes de septiembre: tres alumnas con Mary, una con Paula, cada una con SU hora
// de salida — que es justo el caso de la planilla de Mary.
const LUNES = "2026-09-07";
const OTRO_LUNES = "2026-09-14";
const MES = "2026-09";

const ana = addAlumno({ nombre: `${T}Ana`, mensualidad: 60000 });
addInscripcion({ alumnoId: ana, dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary" });
const bea = addAlumno({ nombre: `${T}Bea`, mensualidad: 60000 });
addInscripcion({ alumnoId: bea, dia: "Lunes", hora: "17:30", horaFin: "18:30", profe: "Mary" });
const cata = addAlumno({ nombre: `${T}Cata`, mensualidad: 120000 });
addInscripcion({ alumnoId: cata, dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: "Paula" });

console.log("1) La base guarda el aviso, sin duplicarlo");
const av1 = avisarAusencia({ alumnoId: ana, tipo: "dia", fecha: LUNES, motivo: "viaje" });
check("guarda la ausencia de un día", av1 > 0, String(av1));
const av1bis = avisarAusencia({ alumnoId: ana, tipo: "dia", fecha: LUNES });
check("avisar dos veces el mismo día NO crea otra fila", av1bis === av1, `${av1} vs ${av1bis}`);
const av2 = avisarAusencia({ alumnoId: bea, tipo: "mes", mes: MES, motivo: "se va de vacaciones" });
check("guarda la ausencia de todo un mes", av2 > 0 && av2 !== av1);
check("el alumno tiene sus dos tipos separados", ausenciasDeAlumno(ana).length === 1 && ausenciasDeAlumno(bea).length === 1);

console.log("\n2) El rango del calendario trae las del día Y las del mes");
const enRango = ausenciasRango("2026-09-01", "2026-09-30").filter(a => [ana, bea, cata].includes(a.alumnoId));
check("trae las dos", enRango.length === 2, String(enRango.length));
const fuera = ausenciasRango("2026-10-01", "2026-10-31").filter(a => [ana, bea, cata].includes(a.alumnoId));
check("un mes distinto no arrastra ninguna", fuera.length === 0, String(fuera.length));
const soloUnaSemana = ausenciasRango("2026-09-01", "2026-09-07").filter(a => [ana, bea, cata].includes(a.alumnoId));
check("la del mes aparece aunque el rango sea de una semana", soloUnaSemana.some(a => a.alumnoId === bea));

console.log("\n3) El día del calendario: una sala por profesora, cada uno con SU hora");
const inscripciones = inscripcionesDeFecha(LUNES)
  .filter(i => i.nombre.startsWith(T))
  .map<InscripcionConAlumno>(i => ({
    id: i.id, alumnoId: i.alumnoId, nombre: i.nombre, dia: i.dia,
    hora: i.hora, horaFin: i.horaFin, profe: i.profe,
  }));
const ausencias = ausenciasRango(LUNES, LUNES);
const bloques = bloquesDelDia(LUNES, inscripciones, ausencias);
check("dos profesoras, dos bloques (no uno por horario)", bloques.length === 2, String(bloques.length));
check("primero la que empieza más temprano", bloques[0].profe === "Paula", String(bloques[0].profe));
const salaMary = bloques.find(b => b.profe === "Mary")!;
check("la sala de Mary junta a sus dos alumnas", salaMary.alumnos.length === 2, String(salaMary.alumnos.length));
check("el rango de la sala va de la primera entrada a la última salida", salaMary.hora === "17:30" && salaMary.horaFin === "19:30", `${salaMary.hora}-${salaMary.horaFin}`);
check("cada alumna conserva SU hora de salida", salaMary.alumnos.find(a => a.nombre === `${T}Bea`)?.horaFin === "18:30");

console.log("\n4) El gris: quien avisó no viene, y se nota");
check("Ana ese lunes sale como avisada", salaMary.alumnos.find(a => a.nombre === `${T}Ana`)?.estado === "aviso-dia");
check("Bea sale como avisada por el mes entero", salaMary.alumnos.find(a => a.nombre === `${T}Bea`)?.estado === "aviso-mes");
check("la sala de Mary cuenta 0 alumnas que sí vienen", salaMary.vienen === 0, String(salaMary.vienen));
check("Cata, que no avisó nada, sale normal", bloques.find(b => b.profe === "Paula")!.alumnos[0].estado === "normal");

console.log("\n5) El otro lunes del mismo mes: la de UN día vuelve, la del MES no");
const insc2 = inscripcionesDeFecha(OTRO_LUNES)
  .filter(i => i.nombre.startsWith(T))
  .map<InscripcionConAlumno>(i => ({
    id: i.id, alumnoId: i.alumnoId, nombre: i.nombre, dia: i.dia,
    hora: i.hora, horaFin: i.horaFin, profe: i.profe,
  }));
const bloques2 = bloquesDelDia(OTRO_LUNES, insc2, ausenciasRango(OTRO_LUNES, OTRO_LUNES));
const mary2 = bloques2.find(b => b.profe === "Mary")!;
check("Ana vuelve a clase el lunes siguiente", mary2.alumnos.find(a => a.nombre === `${T}Ana`)?.estado === "normal");
check("Bea sigue fuera todo el mes", mary2.alumnos.find(a => a.nombre === `${T}Bea`)?.estado === "aviso-mes");
check("esa sala ya cuenta 1 que sí viene", mary2.vienen === 1, String(mary2.vienen));

console.log("\n6) El pase de lista de las 21:00 no pregunta por quien avisó");
const vienen = alumnosQueVienen(LUNES, inscripciones, ausencias);
check("ese lunes solo se le pregunta por Cata", JSON.stringify(vienen) === JSON.stringify([`${T}Cata`]), JSON.stringify(vienen));
const vienen2 = alumnosQueVienen(OTRO_LUNES, insc2, ausenciasRango(OTRO_LUNES, OTRO_LUNES));
check("el lunes siguiente se le pregunta por Ana y Cata", vienen2.includes(`${T}Ana`) && vienen2.includes(`${T}Cata`) && !vienen2.includes(`${T}Bea`), JSON.stringify(vienen2));

console.log("\n7) Deshacer: «sí viene» borra el aviso y todo vuelve a la normalidad");
quitarAusencia(av1);
const bloques3 = bloquesDelDia(LUNES, inscripciones, ausenciasRango(LUNES, LUNES));
check("Ana vuelve a estar normal ese lunes", bloques3.find(b => b.profe === "Mary")!.alumnos.find(a => a.nombre === `${T}Ana`)?.estado === "normal");
check("y ya no queda su fila en la base", ausenciasDeAlumno(ana).length === 0);

console.log("\n8) Los casos hermanos que NO tienen que cambiar");
// Sin ausencias no se toca nada de lo que ya funcionaba.
const limpio = bloquesDelDia(LUNES, inscripciones, []);
check("sin ningún aviso, todos salen normales", limpio.every(b => b.alumnos.every(a => a.estado === "normal")));
check("y se cuentan todos como que vienen", limpio.reduce((n, b) => n + b.vienen, 0) === 3);
// Una inscripción sin día no se cuela en ningún día del calendario.
const sinDia = addAlumno({ nombre: `${T}SinDia` });
addInscripcion({ alumnoId: sinDia, dia: null, hora: "18:30", horaFin: "19:30", profe: null });
const conSinDia = inscripcionesDeFecha(LUNES).filter(i => i.nombre === `${T}SinDia`);
check("la alumna sin día asignado no aparece en el lunes", conSinDia.length === 0, String(conSinDia.length));
// Un aviso de mes de OTRO mes no pinta este.
const dia = addAlumno({ nombre: `${T}Otro` });
addInscripcion({ alumnoId: dia, dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary" });
avisarAusencia({ alumnoId: dia, tipo: "mes", mes: "2026-10" });
const insc3 = inscripcionesDeFecha(LUNES)
  .filter(i => i.nombre === `${T}Otro`)
  .map<InscripcionConAlumno>(i => ({ id: i.id, alumnoId: i.alumnoId, nombre: i.nombre, dia: i.dia, hora: i.hora, horaFin: i.horaFin, profe: i.profe }));
const bloques4 = bloquesDelDia(LUNES, insc3, ausenciasRango(LUNES, LUNES));
check("un aviso de octubre no pinta el lunes de septiembre", bloques4[0].alumnos[0].estado === "normal");

limpiar();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} bien, ${fail} mal\n`);
process.exit(fail === 0 ? 0 : 1);
