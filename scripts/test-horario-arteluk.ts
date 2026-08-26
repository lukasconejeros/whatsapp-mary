// La carga del horario real de Mary: las 9 fotos del Excel que mandó Lukas el 26-08-2026.
//
// 6 días (lunes a sábado), 2 profesoras y 44 filas de planilla. Este test cuida que la
// carga sea FIEL a esas fotos y que NO se invente nada donde la planilla es ambigua:
// los nombres que pueden ser dos personas, la foto que llegó sin encabezado y el Diego
// Torres que aparece dos veces a la misma hora quedan MARCADOS para preguntarle a Mary,
// no resueltos a dedo. Son menores: un teléfono mal pegado es un mensaje al apoderado
// equivocado.
//
// Correr con: npm run test:horario

import "./env-loader.js";
import {
  PLANILLA_AGOSTO_2026,
  construirHorario,
  seedHorarioArteluk,
  seedHorarioSiVacio,
} from "../src/lib/horario-arteluk.js";
import { listAlumnos, listInscripciones, inscripcionesDeFecha, deleteAlumno } from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST horario de Arteluk (las 9 fotos del Excel de Mary)\n");

// ── Parte 1: la planilla, sin tocar la base ──────────────────────────────────
const plan = construirHorario();
const inscripciones = plan.flatMap((a) => a.inscripciones);
const buscar = (n: string) => plan.find((a) => a.nombre === n);

check("la planilla trae las 44 filas leídas de las fotos", PLANILLA_AGOSTO_2026.length === 44, String(PLANILLA_AGOSTO_2026.length));
check("quedan 41 alumnos (los repetidos son la misma ficha)", plan.length === 41, String(plan.length));
check("quedan 43 inscripciones (el Diego Torres duplicado se carga una vez)", inscripciones.length === 43, String(inscripciones.length));

// Mateo viene lunes y martes: UNA ficha, DOS inscripciones.
check("Mateo tiene una sola ficha con dos días", buscar("Mateo")?.inscripciones.length === 2, String(buscar("Mateo")?.inscripciones.length));
check("y son lunes y martes", JSON.stringify(buscar("Mateo")?.inscripciones.map((i) => i.dia)) === '["Lunes","Martes"]', JSON.stringify(buscar("Mateo")?.inscripciones.map((i) => i.dia)));

// 🔑 El hallazgo: misma sala, distinta hora de salida.
const barbara = buscar("Barbara")?.inscripciones[0];
const francisca = buscar("Francisca")?.inscripciones[0];
check("el jueves Barbara entra 17:30 y sale 19:30", barbara?.hora === "17:30" && barbara?.horaFin === "19:30", `${barbara?.hora}-${barbara?.horaFin}`);
check("y Francisca, en la misma sala, sale a las 18:30", francisca?.hora === "17:30" && francisca?.horaFin === "18:30", `${francisca?.hora}-${francisca?.horaFin}`);

// Los nombres de la planilla vienen en minúscula o en mayúscula; en la ficha se ven bien.
check("'diego' queda como Diego", !!buscar("Diego"));
check("'GRACE' queda como Grace", !!buscar("Grace"));
check("'amapola' queda como Amapola", !!buscar("Amapola"));

// Las dos profesoras.
check("el jueves de Paula está rotulado con su nombre", buscar("Agustina")?.inscripciones[0].profe === "Paula", String(buscar("Agustina")?.inscripciones[0].profe));
check("la primera tabla de cada día es Mary", buscar("Matilda")?.inscripciones[0].profe === "Mary", String(buscar("Matilda")?.inscripciones[0].profe));
// El bloque de las 16:00 del lunes lo hace PAULA (Lukas lo preguntó y respondió el 26-08-2026).
check("el bloque de las 16:00 del lunes es de Paula", buscar("Amparo")?.inscripciones[0].profe === "Paula", String(buscar("Amparo")?.inscripciones[0].profe));
check("y ya no lleva la marca de la profesora", !(buscar("Alison")?.revisar ?? "").includes("profesora"), String(buscar("Alison")?.revisar));

// La foto sin encabezado era del JUEVES (Lukas, 26-08-2026). La profesora sigue sin saberse,
// así que se cargan en su día pero marcadas: no se inventa quién les hace la clase.
for (const n of ["Paulina", "Violeta", "Grace"]) {
  check(`${n} viene el jueves y sigue marcada por la profesora`,
    buscar(n)?.inscripciones[0].dia === "Jueves" && buscar(n)?.inscripciones[0].profe === null && !!buscar(n)?.revisar,
    `${buscar(n)?.inscripciones[0].dia} / ${buscar(n)?.inscripciones[0].profe} / ${buscar(n)?.revisar}`);
}

// Diego Torres: dos tablas a la misma hora = imposible, es duplicado de planilla.
check("Diego Torres tiene UNA sola inscripción el sábado", buscar("Diego Torres")?.inscripciones.length === 1, String(buscar("Diego Torres")?.inscripciones.length));
// Ya no hace falta preguntarlo: Lukas confirmó el 26-08 que el sábado es con Mary.
check("y es con Mary, ya confirmado", buscar("Diego Torres")?.inscripciones[0].profe === "Mary", String(buscar("Diego Torres")?.inscripciones[0].profe));
check("y ya no queda marcado", !buscar("Diego Torres")?.revisar, String(buscar("Diego Torres")?.revisar));

// El apoderado sale de la libreta que ya existe, y SOLO cuando la coincidencia es segura.
check("Antonia Pontigo trae a su apoderada y su teléfono", buscar("Antonia Pontigo")?.telefono === "+56976242369" && buscar("Antonia Pontigo")?.apoderado === "Veronica Arteche", `${buscar("Antonia Pontigo")?.apoderado}/${buscar("Antonia Pontigo")?.telefono}`);
check("Elena Jerez también", buscar("Elena Jerez")?.telefono === "+56945496234", String(buscar("Elena Jerez")?.telefono));
check("Ignacia NO trae teléfono: hay dos candidatas en la libreta", buscar("Ignacia")?.telefono === null && !!buscar("Ignacia")?.revisar, `${buscar("Ignacia")?.telefono}`);
check("Sofía tampoco: hay Sofía Reyes y Sophia Iturra", buscar("Sofía")?.telefono === null && !!buscar("Sofía")?.revisar);
check("Diego (jueves) tampoco: hay tres Diego", buscar("Diego")?.telefono === null && !!buscar("Diego")?.revisar);
check("Julieta (sábado) tampoco: hay cuatro Julieta", buscar("Julieta")?.telefono === null && !!buscar("Julieta")?.revisar);

// Los 6 nombres que pueden ser 1 o 2 personas se cargan SEPARADOS y marcados.
check("Amelia y Amelia Brellenthin son dos fichas", !!buscar("Amelia") && !!buscar("Amelia Brellenthin"));
check("Julieta Bratz y Julieta son dos fichas", !!buscar("Julieta Bratz") && !!buscar("Julieta"));
check("Valentina Roa y Valentina son dos fichas", !!buscar("Valentina Roa") && !!buscar("Valentina"));
check("Sofía y Sofía Llancaleo son dos fichas", !!buscar("Sofía") && !!buscar("Sofía Llancaleo"));
check("Elisa y Elisa Bade son dos fichas", !!buscar("Elisa") && !!buscar("Elisa Bade"));
check("Amanda es una sola ficha con jueves y viernes, marcada", buscar("Amanda")?.inscripciones.length === 2 && !!buscar("Amanda")?.revisar, String(buscar("Amanda")?.inscripciones.length));

// Las mensualidades que se leen en las fotos.
check("Agustina paga 120.000", buscar("Agustina")?.mensualidad === 120000, String(buscar("Agustina")?.mensualidad));
check("Amelia Brellenthin paga 60.000", buscar("Amelia Brellenthin")?.mensualidad === 60000, String(buscar("Amelia Brellenthin")?.mensualidad));
check("Elena Jerez paga 100.000", buscar("Elena Jerez")?.mensualidad === 100000, String(buscar("Elena Jerez")?.mensualidad));
check("Aurora paga 45.000", buscar("Aurora")?.mensualidad === 45000, String(buscar("Aurora")?.mensualidad));
check("los que la planilla no dice quedan en 0, no inventados", buscar("Matilda")?.mensualidad === 0, String(buscar("Matilda")?.mensualidad));

// Cuántos por día (contra las fotos).
const porDia = (d: string) => inscripciones.filter((i) => i.dia === d).length;
check("lunes 9", porDia("Lunes") === 9, String(porDia("Lunes")));
check("martes 3", porDia("Martes") === 3, String(porDia("Martes")));
check("miércoles 6", porDia("Miercoles") === 6, String(porDia("Miercoles")));
check("jueves 12 (5 de Mary + 4 de Paula + las 3 de la foto sin encabezado)", porDia("Jueves") === 12, String(porDia("Jueves")));
check("viernes 6", porDia("Viernes") === 6, String(porDia("Viernes")));
check("sábado 7 (sin el Diego Torres repetido)", porDia("Sabado") === 7, String(porDia("Sabado")));
check("ya no queda nadie sin día", inscripciones.filter((i) => i.dia === null).length === 0, String(inscripciones.filter((i) => i.dia === null).length));

// ── Parte 2: la carga en la base, que es lo que verá Mary ────────────────────
// Ojo: siembra en la base LOCAL de pruebas. Al final se borra solo lo que sembró.
//
// 🔒 Y si el horario YA estaba cargado (por ejemplo porque se arrancó la app antes),
// las partes 2 y 3 se saltan enteras: si no, la limpieza por nombre borraría a
// alumnos de verdad que este test no sembró. Un test también tiene alcance
// (Lukas, 04-08-2026: "antes de tocar los tests o los datos, mirar a quién más le pegan").
const nombresPlan = new Set(plan.map((a) => a.nombre));
const yaCargado = listAlumnos().some((a) => nombresPlan.has(a.nombre));

if (yaCargado) {
  console.log("\n  ⚠️  Las partes 2 y 3 se saltan: la base ya tiene el horario cargado.");
  console.log("      (para probarlas, corre el test con la tabla de alumnos vacía)\n");
} else {
const antes = listAlumnos().length;
const r1 = seedHorarioArteluk();
check("la primera carga crea los 41 alumnos", r1.alumnos === 41, String(r1.alumnos));
check("y sus 43 inscripciones", r1.inscripciones === 43, String(r1.inscripciones));

// Idempotente: correrla otra vez NO duplica (arranca en cada deploy).
const r2 = seedHorarioArteluk();
check("correrla otra vez no crea a nadie", r2.alumnos === 0, String(r2.alumnos));
check("ni repite inscripciones", r2.inscripciones === 0, String(r2.inscripciones));
check("en la base hay 41 alumnos nuevos, ni uno más", listAlumnos().length === antes + 41, String(listAlumnos().length - antes));

// El calendario de verdad: un jueves cualquiera trae a los 9, cada uno con SU salida.
const jueves = inscripcionesDeFecha("2026-08-27");
check("el jueves salen los 12 alumnos", jueves.length === 12, String(jueves.length));
check("ordenados por hora de entrada", jueves[0].hora <= jueves[jueves.length - 1].hora, JSON.stringify(jueves.map((i) => i.hora)));
check("Barbara hasta las 19:30 y Francisca hasta las 18:30, el mismo día",
  jueves.find((i) => i.nombre === "Barbara")?.horaFin === "19:30" && jueves.find((i) => i.nombre === "Francisca")?.horaFin === "18:30",
  JSON.stringify(jueves.map((i) => `${i.nombre}:${i.horaFin}`)));
const domingo = inscripcionesDeFecha("2026-08-30");
check("el domingo no hay clases", domingo.length === 0, String(domingo.length));

// Limpieza: se borra SOLO lo que sembró este test, por nombre de la planilla.
for (const a of listAlumnos()) if (nombresPlan.has(a.nombre)) deleteAlumno(a.id);
check("el test deja la base como estaba", listAlumnos().length === antes, String(listAlumnos().length));
check("y sin inscripciones huérfanas", listInscripciones().length === 0, String(listInscripciones().length));

// ── Parte 3: la carga de la primera vez, que es la que corre sola al arrancar ─
// Solo siembra con la tabla VACÍA. Si Mary ya borró o cambió alumnos, el arranque
// siguiente NO se los vuelve a poner (sería deshacerle el trabajo cada deploy).
if (listAlumnos().length === 0) {
  const p1 = seedHorarioSiVacio();
  check("con la tabla vacía, el arranque carga el horario", p1.alumnos === 41, String(p1.alumnos));
  const p2 = seedHorarioSiVacio();
  check("con alumnos ya cargados, el arranque no toca nada", p2.alumnos === 0 && p2.inscripciones === 0, JSON.stringify(p2));
  deleteAlumno(listAlumnos()[0].id);
  const p3 = seedHorarioSiVacio();
  check("y si Mary borra un alumno, NO se lo devuelve al arrancar", p3.alumnos === 0, String(p3.alumnos));
  for (const a of listAlumnos()) if (nombresPlan.has(a.nombre)) deleteAlumno(a.id);
  check("la base vuelve a quedar como estaba", listAlumnos().length === antes, String(listAlumnos().length));
} else {
  console.log("  ⚠️  la parte 3 se saltó: la base ya tenía alumnos antes del test");
}
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
