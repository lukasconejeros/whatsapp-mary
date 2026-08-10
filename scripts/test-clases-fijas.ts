// Las clases que se repiten TODAS las semanas (los alumnos fijos de Mary).
//
// Lukas, 10-08-2026: "esos son alumnos, esos se tienen que repetir todas las semanas
// (…) y que aparezcan de forma estructurada y ordenada".
//
// La academia funciona lunes, martes y miércoles (él confirmó que jueves, viernes y
// sábado no tienen clases). Una clase fija NO es una fila por día: es UNA fila que
// vale para todos los lunes, como la Suscripción mensual de la app de Lukas.
//
// Correr con: npm run test:clases-fijas

import "./env-loader.js";
import {
  addClaseFija,
  listClasesFijas,
  updateClaseFija,
  deleteClaseFija,
  clasesFijasDeFecha,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST clases fijas (los alumnos que se repiten cada semana)\n");

// Se limpia lo de corridas anteriores por si una reventó a medias.
for (const f of listClasesFijas()) if (f.profe === "ProfeDePrueba") deleteClaseFija(f.id);

// 1) Se crea una clase fija del lunes y se lee entera.
const idTarde = addClaseFija({
  dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "ProfeDePrueba",
  alumnos: ["Mateo", "Matilda"], cuposPrueba: 2,
});
const creada = listClasesFijas().find((f) => f.id === idTarde);
check("se guarda la clase fija", !!creada);
check("guarda el bloque de horario entero", creada?.hora === "17:30" && creada?.horaFin === "19:30", `${creada?.hora}-${creada?.horaFin}`);
check("guarda los alumnos como lista", JSON.stringify(creada?.alumnos) === '["Mateo","Matilda"]', JSON.stringify(creada?.alumnos));
check("guarda los cupos de prueba", creada?.cuposPrueba === 2, String(creada?.cuposPrueba));
check("nace activa", creada?.activa === true);

// 2) Se repite TODOS los lunes: sale en dos lunes distintos y en ninguno de los otros días.
//    10 y 17 de agosto de 2026 son lunes; el 13 es jueves y el 16 domingo.
const lunes10 = clasesFijasDeFecha("2026-08-10").map((f) => f.id);
const lunes17 = clasesFijasDeFecha("2026-08-17").map((f) => f.id);
const jueves13 = clasesFijasDeFecha("2026-08-13").map((f) => f.id);
const domingo16 = clasesFijasDeFecha("2026-08-16").map((f) => f.id);
check("aparece el lunes 10", lunes10.includes(idTarde));
check("aparece TAMBIÉN el lunes 17 (se repite)", lunes17.includes(idTarde));
check("NO aparece el jueves 13", !jueves13.includes(idTarde));
check("NO aparece el domingo 16", !domingo16.includes(idTarde));

// 3) Orden dentro del día: por hora, que es como Mary lee su planilla.
const idManana = addClaseFija({ dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: "ProfeDePrueba", alumnos: ["Alison"], cuposPrueba: 0 });
const idNoche = addClaseFija({ dia: "Lunes", hora: "18:30", horaFin: "19:30", profe: "ProfeDePrueba", alumnos: ["Julieta Bratz"], cuposPrueba: 1 });
const delLunes = clasesFijasDeFecha("2026-08-10").filter((f) => f.profe === "ProfeDePrueba");
check("los bloques del día salen ordenados por hora", JSON.stringify(delLunes.map((f) => f.hora)) === '["16:00","17:30","18:30"]', JSON.stringify(delLunes.map((f) => f.hora)));

// 4) Editar: cambiar alumnos y horario de una clase fija los cambia en TODAS las semanas.
updateClaseFija(idManana, { dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: "ProfeDePrueba", alumnos: ["Alison", "Amelia", "Amparo"], cuposPrueba: 0 });
const editada10 = clasesFijasDeFecha("2026-08-10").find((f) => f.id === idManana);
const editada17 = clasesFijasDeFecha("2026-08-17").find((f) => f.id === idManana);
check("el alumno nuevo aparece esta semana", editada10?.alumnos.length === 3, String(editada10?.alumnos.length));
check("y también la semana siguiente", editada17?.alumnos.length === 3, String(editada17?.alumnos.length));

// 5) Dar de baja: una clase que ya no se hace deja de salir en el calendario, pero
//    NO se borra, para no perder el historial de quién venía.
updateClaseFija(idNoche, { dia: "Lunes", hora: "18:30", horaFin: "19:30", profe: "ProfeDePrueba", alumnos: ["Julieta Bratz"], cuposPrueba: 1, activa: false });
check("la clase dada de baja NO sale en el calendario", !clasesFijasDeFecha("2026-08-10").some((f) => f.id === idNoche));
check("pero sigue existiendo en la lista de administración", listClasesFijas().some((f) => f.id === idNoche));

// 6) Borrar de verdad.
deleteClaseFija(idNoche);
check("borrada de verdad, ya no está en la lista", !listClasesFijas().some((f) => f.id === idNoche));

// Limpieza: que el test no deje basura en la base.
for (const f of listClasesFijas()) if (f.profe === "ProfeDePrueba") deleteClaseFija(f.id);
check("el test no deja datos suyos en la base", !listClasesFijas().some((f) => f.profe === "ProfeDePrueba"));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
