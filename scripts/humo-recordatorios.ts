// Prueba de humo E2E de los recordatorios del calendario contra la DB real:
// crea una clase de prueba dentro de la ventana de 5 h, corre el tick del loop
// dos veces (debe avisar UNA sola vez) y luego BORRA solo esa clase.
import "./env-loader.js";
import { addClase, deleteClase, listClasesRange, updateClase } from "../src/lib/db.js";
import { tickRecordatorios } from "../src/lib/recordatorios-loop.js";
import { todaySantiago, nowSantiago } from "../src/lib/fechas.js";
import { diaFromFecha } from "../src/lib/calendario.js";
import { pushConfigurado } from "../src/lib/push.js";

// Las VAPID de verdad viven solo en EasyPanel, así que en local el tick se sale
// antes de hacer nada y el humo daría rojo sin que haya ningún bug. Para correrlo
// aquí basta con unas claves de mentira (no hay suscriptores locales a quien
// mandarles nada):
//   node -e "const w=require('web-push');const v=w.generateVAPIDKeys();console.log(v.publicKey,v.privateKey)"
//   VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:x@y npx tsx scripts/humo-recordatorios.ts
if (!pushConfigurado()) {
  console.log("\n⚠️  Sin claves VAPID en el entorno el planificador no hace nada. Mira el comentario de arriba para correr este humo en local.\n");
  process.exit(1);
}

let pass = 0, fail = 0;
const check = (n: string, c: boolean, extra = "") => {
  if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${extra}`); fail++; }
};

const hoy = todaySantiago();
const ahora = nowSantiago().slice(11);
const horaAhora = parseInt(ahora.slice(0, 2), 10);
const ANTELACION_H = 4; // dentro de la ventana de 5 h

// Si la clase de prueba se pasara de medianoche quedaría en el pasado del mismo
// día y el humo fallaría por el reloj, no por un bug. Tampoco corre en la franja
// de silencio (23:00-07:00), donde por diseño no sale ningún push.
if (horaAhora + ANTELACION_H > 23 || horaAhora >= 23 || horaAhora < 7) {
  console.log(`\n⏭️  A las ${ahora} este humo no aplica (silencio nocturno o la clase se pasaría de medianoche). Correlo entre las 07:00 y las 19:00.\n`);
  process.exit(0);
}

const enCuatroHoras = `${String(horaAhora + ANTELACION_H).padStart(2, "0")}:${ahora.slice(3)}`;

console.log(`\n🧪 HUMO recordatorios del calendario (hoy ${hoy}, ahora ${ahora}, clase a las ${enCuatroHoras})\n`);

const id = addClase({
  fecha: hoy, dia: diaFromFecha(hoy), profe: "Mary", hora: enCuatroHoras,
  alumnos: ["PRUEBA DE HUMO"], nota: "bórrame",
});
console.log(`  (clase de prueba id=${id})`);

const leer = () => listClasesRange(hoy, hoy).find((c) => c.id === id);

try {
  check("nace sin aviso enviado", leer()?.aviso_5h === 0, JSON.stringify(leer()));

  await tickRecordatorios();
  check("tras el primer tick queda marcado el aviso de 5 h", leer()?.aviso_5h === 1, JSON.stringify(leer()));

  await tickRecordatorios();
  check("el segundo tick NO lo vuelve a marcar (idempotente)", leer()?.aviso_5h === 1);

  // Mover la clase debe reabrir el aviso: ya no es el mismo horario.
  updateClase(id, {
    fecha: hoy, dia: diaFromFecha(hoy), profe: "Mary", hora: `${String(horaAhora + 3).padStart(2, "0")}:${ahora.slice(3)}`,
    alumnos: ["PRUEBA DE HUMO"], nota: "bórrame",
  });
  check("mover la clase limpia la marca", leer()?.aviso_5h === 0, JSON.stringify(leer()));

  // Editarla SIN cambiar el horario no debe reabrirla (si no, avisa dos veces).
  updateClase(id, {
    fecha: hoy, dia: diaFromFecha(hoy), profe: "Paula", hora: `${String(horaAhora + 3).padStart(2, "0")}:${ahora.slice(3)}`,
    alumnos: ["PRUEBA DE HUMO"], nota: "bórrame",
  });
  await tickRecordatorios();
  const antes = leer()?.aviso_5h;
  updateClase(id, {
    fecha: hoy, dia: diaFromFecha(hoy), profe: "Mary", hora: `${String(horaAhora + 3).padStart(2, "0")}:${ahora.slice(3)}`,
    alumnos: ["PRUEBA DE HUMO", "otro"], nota: "bórrame",
  });
  check("cambiar alumnos/profe sin mover la hora NO reabre el aviso",
    antes === 1 && leer()?.aviso_5h === 1, `${antes} → ${leer()?.aviso_5h}`);
} finally {
  deleteClase(id); // solo la de prueba: jamás se toca nada más
  check("la clase de prueba quedó borrada", leer() === undefined);
}

console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
