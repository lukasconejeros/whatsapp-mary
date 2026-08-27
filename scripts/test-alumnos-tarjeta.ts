// ── TARJETAS COMPACTAS + EL DÍA DE CLASE EDITABLE (Lukas, 27-08-2026) ─────────
//
// Dos encargos suyos sobre la pestaña Alumnos:
//   (2) "tarjetas compactas: fuera el horario y la plata de la tarjeta",
//   (3) la ficha, al abrirla, tiene que dejar EDITAR el día de clase ya puesto
//       (hasta hoy solo se podía borrar y crear otro).
//
// Se comprueba leyendo el componente, que es donde vive la decisión de qué se
// dibuja. Lo de verdad (que se vea en pantalla) lo prueba test-alumnos-api.mjs
// con Playwright; esto es el filtro rápido que corre sin navegador.

import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST tarjetas compactas y el día de clase editable (27-08-2026)\n");

const src = readFileSync("src/app/alumnos/page.tsx", "utf8");

// El archivo tiene dos mitades que hay que mirar por separado: lo que dibuja la
// TARJETA del listado y lo que dibuja la FICHA que se abre encima.
const iTarjeta = src.indexOf("function Tarjeta(");
const iEditor = src.indexOf("function Editor(");
check("el archivo tiene Tarjeta y Editor", iTarjeta > 0 && iEditor > iTarjeta, `${iTarjeta}/${iEditor}`);
const tarjeta = src.slice(iTarjeta, iEditor);
const editor = src.slice(iEditor);

// ── (2) La tarjeta compacta: fuera el horario y fuera la plata ───────────────
check("la tarjeta ya NO dibuja los chips de horario", !/DIA_CORTO\[/.test(tarjeta), "sigue pintando el horario");
check("la tarjeta ya NO dibuja la mensualidad", !/mensualidad por definir/.test(tarjeta), "sigue pintando la mensualidad");
check("la tarjeta ya NO dibuja el chip de pago", !/PAGO_CHIP\[/.test(tarjeta), "sigue pintando el pago");

// Lo que SÍ se queda: el nombre, y las señales que Mary necesita de un vistazo.
check("la tarjeta sigue mostrando el nombre", /f\.nombre/.test(tarjeta));
check("la tarjeta sigue avisando de las faltas", /f\.faltas\.length/.test(tarjeta), "se perdió el aviso de faltas");
check("la tarjeta sigue mostrando el triángulo amarillo", /f\.revisar/.test(tarjeta), "se perdió el aviso de revisar");

// ── El horario y la plata NO se pierden: se ven al abrir la ficha ────────────
check("la ficha sigue mostrando el horario", /DIA_LABEL\[/.test(editor), "el horario no aparece en la ficha");
check("la ficha sigue mostrando la mensualidad", /Mensualidad/.test(editor), "la mensualidad no aparece en la ficha");

// ── (3) El día de clase se puede EDITAR, no solo borrar ─────────────────────
check("la ficha tiene un editor de día de clase", /function DiaEditable\(/.test(src), "no existe DiaEditable");
check("la ficha usa DiaEditable para cada día", /<DiaEditable/.test(editor), "el Editor no lo usa");
check("guarda el día contra la API de inscripciones", /\/api\/inscripciones\/\$\{[^}]+\}`?,\s*\{?\s*\n?\s*method:\s*'PATCH'/.test(src) || /method:\s*'PATCH'[^}]*\}\)\s*$/m.test(src) && /inscripciones/.test(src), "no hace PATCH a inscripciones");
check("se puede cambiar la hora de entrada", /hora/.test(src.slice(src.indexOf("function DiaEditable("))), "sin campo hora");
check("se puede cambiar la hora de salida", /horaFin/.test(src.slice(src.indexOf("function DiaEditable("))), "sin campo horaFin");
check("se puede cambiar la profesora", /profe/.test(src.slice(src.indexOf("function DiaEditable("))), "sin campo profe");
check("se puede cambiar el día", /dia/.test(src.slice(src.indexOf("function DiaEditable("))), "sin campo dia");

// ── La familia: borrar un día y agregar uno nuevo siguen existiendo ─────────
check("sigue el botón de sacar un día", /borrarDia/.test(editor), "se perdió el borrar");
check("sigue el formulario de agregar un día", /<NuevoDia/.test(editor), "se perdió el agregar");

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} bien, ${fail} mal\n`);
process.exit(fail === 0 ? 0 : 1);
