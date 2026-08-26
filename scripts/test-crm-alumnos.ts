// El CRM de alumnos: UNA TARJETA POR ALUMNO, ordenada por mes (Lukas, 26-08-2026:
// "un CRM aparte, pestaña propia a la izquierda, una tarjeta por alumno, ordenado por
// mes, que no sea plano, en correlación con el calendario").
//
// Lo que se prueba aquí es la vista que alimenta esa pantalla: qué días viene cada
// uno, cuánto paga, qué faltas lleva EN ESE MES (salen solas del pase de lista de las
// 21:00 que ya existe) y qué dudas de la planilla siguen sin resolver.
//
// Ojo con el mes: un contador sin ventana de tiempo no dice nada. Las faltas de julio
// no pueden aparecer cuando Mary mira agosto.
//
// Correr con: npm run test:crm

import "./env-loader.js";
import { fichasDelMes } from "../src/lib/crm-alumnos.js";
import {
  addAlumno, addInscripcion, deleteAlumno, listAlumnos,
  marcarAsistencia, borrarAsistencia, avisarAusencia,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const T = "ZZTest ";
function limpiar() { for (const a of listAlumnos()) if (a.nombre.startsWith(T)) deleteAlumno(a.id); }

console.log("\n🧪 TEST CRM de alumnos (la pestaña Alumnos, por mes)\n");
limpiar();

// Una alumna de dos días, con su mensualidad y su apoderada.
const ana = addAlumno({ nombre: `${T}Ana`, apoderado: "Mamá de Ana", telefono: "+56911111111", mensualidad: 60000 });
addInscripcion({ alumnoId: ana, dia: "Miercoles", hora: "18:30", horaFin: "19:30", profe: "Paula" });
addInscripcion({ alumnoId: ana, dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary" });
// Una de un solo día, con una duda de la planilla sin resolver.
const bea = addAlumno({ nombre: `${T}Bea`, mensualidad: 120000, revisar: "no está en la libreta" });
addInscripcion({ alumnoId: bea, dia: "Sabado", hora: "11:00", horaFin: "13:00", profe: "Mary" });
// Una sin día: la foto que llegó sin encabezado.
const cata = addAlumno({ nombre: `${T}Cata`, revisar: "falta el día" });
addInscripcion({ alumnoId: cata, dia: null, hora: "18:30", horaFin: "19:30", profe: null });

const mias = (mes: string) => fichasDelMes(mes).filter((f) => f.nombre.startsWith(T));

// 1) Una tarjeta por alumno, no una por clase.
let f = mias("2026-08");
check("hay una tarjeta por alumno", f.length === 3, String(f.length));
check("Ana sale UNA vez aunque venga dos días", f.filter((x) => x.nombre === `${T}Ana`).length === 1);
check("y su tarjeta trae sus dos días", f.find((x) => x.nombre === `${T}Ana`)?.inscripciones.length === 2);

// 2) "Que no sea plano": se leen como el calendario, del lunes al sábado.
check("las tarjetas van ordenadas por el día en que vienen", JSON.stringify(f.map((x) => x.nombre)) === JSON.stringify([`${T}Ana`, `${T}Bea`, `${T}Cata`]), JSON.stringify(f.map((x) => x.nombre)));
check("los días de cada tarjeta salen de lunes a domingo", JSON.stringify(f[0].inscripciones.map((i) => i.dia)) === '["Lunes","Miercoles"]', JSON.stringify(f[0].inscripciones.map((i) => i.dia)));
check("la que no tiene día queda al final", f[f.length - 1].nombre === `${T}Cata`, f[f.length - 1].nombre);

// 3) La ficha trae lo del CRM: quién paga, cuánto y qué falta por confirmar.
const fAna = f.find((x) => x.nombre === `${T}Ana`)!;
check("trae el apoderado y su teléfono", fAna.apoderado === "Mamá de Ana" && fAna.telefono === "+56911111111");
check("trae la mensualidad", fAna.mensualidad === 60000, String(fAna.mensualidad));
check("Bea muestra la duda que hay que preguntarle a Mary", !!f.find((x) => x.nombre === `${T}Bea`)?.revisar);
check("Ana no tiene ninguna duda pendiente", fAna.revisar === null, String(fAna.revisar));

// 4) LAS FALTAS DEL MES. Salen del pase de lista de las 21:00, que ya existe.
marcarAsistencia("2026-08-03", `${T}Ana`, "falto", "whatsapp");   // lunes 3 de agosto
marcarAsistencia("2026-08-05", `${T}Ana`, "vino", "whatsapp");
marcarAsistencia("2026-08-10", `${T}Ana`, "falto", "panel");      // corregida a mano
marcarAsistencia("2026-07-28", `${T}Ana`, "falto", "whatsapp");   // JULIO: no es de este mes
f = mias("2026-08");
const ago = f.find((x) => x.nombre === `${T}Ana`)!;
check("agosto cuenta 2 faltas", ago.faltas.length === 2, JSON.stringify(ago.faltas));
check("y trae los días exactos, para la clase recuperativa", JSON.stringify(ago.faltas) === '["2026-08-03","2026-08-10"]', JSON.stringify(ago.faltas));
check("la falta de julio NO se cuela en agosto", !ago.faltas.includes("2026-07-28"));
check("también dice cuántos días vino", ago.vino === 1, String(ago.vino));

const jul = fichasDelMes("2026-07").find((x) => x.nombre === `${T}Ana`)!;
check("mirando julio, la falta de julio sí aparece", JSON.stringify(jul.faltas) === '["2026-07-28"]', JSON.stringify(jul.faltas));
check("y las de agosto no", jul.faltas.length === 1, String(jul.faltas.length));
check("Bea, que no faltó, sale con la lista vacía", f.find((x) => x.nombre === `${T}Bea`)?.faltas.length === 0);

// 5) El alumno dado de baja no ensucia el CRM del mes.
const dado = addAlumno({ nombre: `${T}Dado`, activo: false });
addInscripcion({ alumnoId: dado, dia: "Lunes", hora: "17:30", horaFin: "18:30", profe: "Mary" });
check("el alumno dado de baja no sale en el CRM", !mias("2026-08").some((x) => x.nombre === `${T}Dado`));

// 6) EL BOTÓN "NO VIENE" (Lukas, 26-08-2026). Dos cosas distintas:
//    · un día suelto  → sigue en el CRM, con su día avisado y su clase recuperativa.
//    · el mes entero  → "que se salga del CRM solo ese mes", y en septiembre vuelve.
avisarAusencia({ alumnoId: ana, tipo: "dia", fecha: "2026-08-17", motivo: "viaje" });
avisarAusencia({ alumnoId: bea, tipo: "mes", mes: "2026-08", motivo: "operación" });
f = mias("2026-08");
const anaAgo = f.find((x) => x.nombre === `${T}Ana`)!;
const beaAgo = f.find((x) => x.nombre === `${T}Bea`)!;
check("el día avisado sale aparte de las faltas del pase de lista", JSON.stringify(anaAgo.avisadas) === '["2026-08-17"]', JSON.stringify(anaAgo.avisadas));
check("sus 2 faltas siguen intactas", anaAgo.faltas.length === 2, JSON.stringify(anaAgo.faltas));
check("y las recuperativas suman faltas + días avisados", anaAgo.recuperativas === 3, String(anaAgo.recuperativas));
check("Ana NO se sale del CRM por faltar un día", anaAgo.noVieneEsteMes === false);
check("Bea sí queda marcada como que no viene este mes", beaAgo.noVieneEsteMes === true);
check("y trae el motivo y el id para poder deshacerlo", beaAgo.motivoMes === "operación" && !!beaAgo.ausenciaMesId);
check("Bea sigue en la lista (para devolverla con un toque), no desaparece", !!beaAgo);
const sept = fichasDelMes("2026-09");
check("en septiembre Bea vuelve a venir", sept.find((x) => x.nombre === `${T}Bea`)?.noVieneEsteMes === false);
check("y el día avisado de agosto no se cuela en septiembre", sept.find((x) => x.nombre === `${T}Ana`)?.avisadas.length === 0);
const julio2 = fichasDelMes("2026-07").find((x) => x.nombre === `${T}Bea`)!;
check("ni el mes avisado se cuela en julio", julio2.noVieneEsteMes === false);

// Limpieza (también la asistencia de prueba, que va por nombre y no se borra sola).
for (const d of ["2026-08-03", "2026-08-05", "2026-08-10", "2026-07-28"]) borrarAsistencia(d, `${T}Ana`);
limpiar();
check("el test no deja alumnos suyos", !listAlumnos().some((a) => a.nombre.startsWith(T)));
check("ni asistencia suya", fichasDelMes("2026-08").every((x) => !x.nombre.startsWith(T)));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} bien, ${fail} mal\n`);
process.exit(fail === 0 ? 0 : 1);
