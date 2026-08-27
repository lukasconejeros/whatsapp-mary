// EL ENGANCHE del comprobante con el alumno (lo que faltaba del paso 4, Lukas 26-08-2026).
//
// Llega la foto de una transferencia al WhatsApp de Mary y hay que saber DE QUIÉN es
// ese pago para marcarle la mensualidad. Las señales, por fuerza (decisión razonada
// con Lukas):
//   1. El TELÉFONO del chat de donde llegó la foto. Es exacto y acierta siempre.
//   2. El MONTO, para desempatar entre hermanos con mensualidades distintas.
//   3. El NOMBRE del titular, SOLO como refuerzo: en Chile paga el papá, la abuela o
//      un tío con otro apellido ⇒ NUNCA decide solo.
//
// 🔑 La regla de oro de esta app (05-08-2026): nada se marca solo. Aquí se PROPONE y
// Mary toca. Un pago cargado al hermano equivocado le deja a una familia una deuda
// que no tiene y a la otra un pago que no hizo.
//
// Correr con: npm run test:pago-alumno

import "./env-loader.js";
import { emparejarPago, repartirMonto, type AlumnoParaPago } from "../src/lib/pago-alumno.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST del enganche comprobante → alumno\n");

const base: AlumnoParaPago = {
  id: 0, nombre: "", apoderado: null, telefono: null,
  mensualidad: 60000, activo: true, yaPagoElMes: false, noVieneEsteMes: false,
};
const alumno = (d: Partial<AlumnoParaPago>): AlumnoParaPago => ({ ...base, ...d });

// La familia de prueba: dos hermanas con el MISMO teléfono (el caso real de la
// planilla de Mary) y una niña suelta de otra casa.
const SOFIA = alumno({ id: 1, nombre: "Sofia Llancaleo", apoderado: "Carla Llancaleo", telefono: "56912340001", mensualidad: 60000 });
const AMPARO = alumno({ id: 2, nombre: "Amparo Sepulveda", apoderado: "Judith Higueras", telefono: "56912340002", mensualidad: 60000 });
const AMELIA = alumno({ id: 3, nombre: "Amelia Sepulveda", apoderado: "Judith Higueras", telefono: "56912340002", mensualidad: 75000 });
const SUELTA = alumno({ id: 4, nombre: "Barbara Vera", apoderado: null, telefono: null, mensualidad: 60000 });
const TODOS = [SOFIA, AMPARO, AMELIA, SUELTA];

const HOY = "2026-09-05";

console.log("1) El teléfono manda: es exacto y acierta siempre");
{
  const r = emparejarPago({ telefono: "56912340001", monto: 60000, nombreTitular: null, fecha: HOY, alumnos: TODOS });
  check("una sola alumna en ese teléfono ⇒ queda elegida", r.elegido?.alumnoIds.join() === "1", JSON.stringify(r.elegido));
  check("y se propone marcarle el mes de la fecha del pago", r.mes === "2026-09", String(r.mes));
  check("no se cuelan alumnos de otros teléfonos", r.candidatos.every((c) => !c.alumnoIds.includes(4)));
}
{
  const r = emparejarPago({ telefono: "+56 9 1234 0001", monto: 60000, nombreTitular: null, fecha: HOY, alumnos: TODOS });
  check("el teléfono calza aunque venga con espacios y +56", r.elegido?.alumnoIds.join() === "1", JSON.stringify(r.elegido));
}
{
  const r = emparejarPago({ telefono: "912340001", monto: 60000, nombreTitular: null, fecha: HOY, alumnos: TODOS });
  check("y calza escrito como lo marca uno en Chile (9 1234 0001)", r.elegido?.alumnoIds.join() === "1");
}

console.log("\n2) Hermanas en el mismo teléfono: el monto desempata");
{
  const r = emparejarPago({ telefono: "56912340002", monto: 75000, nombreTitular: null, fecha: HOY, alumnos: TODOS });
  check("el monto calza con la mensualidad de UNA sola ⇒ esa queda elegida", r.elegido?.alumnoIds.join() === "3", JSON.stringify(r.elegido));
  check("la hermana sigue ofrecida como alternativa", r.candidatos.some((c) => c.alumnoIds.join() === "2"));
}
{
  const iguales = [alumno({ id: 5, nombre: "Ana Soto", telefono: "56912340003", mensualidad: 60000 }),
                   alumno({ id: 6, nombre: "Luz Soto", telefono: "56912340003", mensualidad: 60000 })];
  const r = emparejarPago({ telefono: "56912340003", monto: 60000, nombreTitular: null, fecha: HOY, alumnos: iguales });
  check("dos hermanas con la MISMA mensualidad ⇒ NADIE queda elegido, elige Mary", r.elegido === null, JSON.stringify(r.elegido));
  check("pero las dos se le ofrecen", r.candidatos.length === 2, String(r.candidatos.length));
}
{
  // El caso de las dos transferencias iguales: la segunda es del hermano que falta.
  const iguales = [alumno({ id: 5, nombre: "Ana Soto", telefono: "56912340003", mensualidad: 60000, yaPagoElMes: true }),
                   alumno({ id: 6, nombre: "Luz Soto", telefono: "56912340003", mensualidad: 60000 })];
  const r = emparejarPago({ telefono: "56912340003", monto: 60000, nombreTitular: null, fecha: HOY, alumnos: iguales });
  check("si una hermana YA pagó el mes, el pago es de la otra", r.elegido?.alumnoIds.join() === "6", JSON.stringify(r.elegido));
  check("la que ya pagó sale avisada, no escondida", r.candidatos.find((c) => c.alumnoIds.join() === "5")?.avisos.some((a) => /ya pag/i.test(a)) === true);
}
{
  const r = emparejarPago({ telefono: "56912340002", monto: 135000, nombreTitular: null, fecha: HOY, alumnos: TODOS });
  check("un pago por LAS DOS hermanas (60.000 + 75.000) se propone repartido", r.elegido?.alumnoIds.sort().join() === "2,3", JSON.stringify(r.elegido));
  check("y se dice en la propuesta que son las dos", /dos|ambas|2 alumn/i.test(r.elegido?.razon ?? ""), r.elegido?.razon);
}

console.log("\n3) El monto que no calza con nada NO descarta a la familia");
{
  const r = emparejarPago({ telefono: "56912340001", monto: 33000, nombreTitular: null, fecha: HOY, alumnos: TODOS });
  check("sigue elegida la única alumna de ese teléfono", r.elegido?.alumnoIds.join() === "1", JSON.stringify(r.elegido));
  check("pero avisa que el monto no es su mensualidad", r.elegido?.avisos.some((a) => /monto/i.test(a)) === true, JSON.stringify(r.elegido?.avisos));
}

console.log("\n4) El nombre del titular NUNCA decide solo (paga el papá, la abuela, un tío)");
{
  const r = emparejarPago({ telefono: "56999999999", monto: 60000, nombreTitular: "Carla Llancaleo", fecha: HOY, alumnos: TODOS });
  check("con el nombre calzado se OFRECE la candidata", r.candidatos.some((c) => c.alumnoIds.join() === "1"), JSON.stringify(r.candidatos));
  check("pero NO queda elegida: la elige Mary", r.elegido === null, JSON.stringify(r.elegido));
  check("y se dice que el calce es por el nombre", /nombre/i.test(r.candidatos[0]?.razon ?? ""), r.candidatos[0]?.razon);
}
{
  const r = emparejarPago({ telefono: "56999999999", monto: 60000, nombreTitular: "Juan Perez", fecha: HOY, alumnos: TODOS });
  check("sin teléfono ni nombre que calcen no se inventa a nadie", r.candidatos.length === 0 && r.elegido === null, JSON.stringify(r));
}

console.log("\n5) Quién no puede recibir un pago");
{
  const dado_de_baja = [alumno({ id: 7, nombre: "Ya no viene", telefono: "56912340009", activo: false })];
  const r = emparejarPago({ telefono: "56912340009", monto: 60000, nombreTitular: null, fecha: HOY, alumnos: dado_de_baja });
  check("un alumno dado de baja no aparece", r.candidatos.length === 0, JSON.stringify(r.candidatos));
}
{
  const avisado = [alumno({ id: 8, nombre: "Se fue en septiembre", telefono: "56912340010", noVieneEsteMes: true })];
  const r = emparejarPago({ telefono: "56912340010", monto: 60000, nombreTitular: null, fecha: HOY, alumnos: avisado });
  check("quien avisó que no viene este mes se ofrece igual (pagó, es su plata)", r.candidatos.length === 1);
  check("pero con el aviso a la vista", r.candidatos[0]?.avisos.some((a) => /no viene/i.test(a)) === true, JSON.stringify(r.candidatos[0]?.avisos));
  check("y no queda elegido solo: eso lo mira Mary", r.elegido === null, JSON.stringify(r.elegido));
}

console.log("\n6) El mes que se propone es el de la fecha del pago, no el de hoy");
{
  const r = emparejarPago({ telefono: "56912340001", monto: 60000, nombreTitular: null, fecha: "2026-08-29", alumnos: TODOS });
  check("una transferencia del 29 de agosto marca AGOSTO", r.mes === "2026-08", String(r.mes));
}
{
  const r = emparejarPago({ telefono: "56912340001", monto: 60000, nombreTitular: null, fecha: "no es fecha", alumnos: TODOS });
  check("una fecha rota no rompe el enganche (mes vacío, lo pone Mary)", r.mes === null, String(r.mes));
}

console.log("\n7) Nada se marca solo: la propuesta es propuesta");
{
  const r = emparejarPago({ telefono: "56912340002", monto: 75000, nombreTitular: null, fecha: HOY, alumnos: TODOS });
  check("el elegido también viene dentro de los candidatos, para poder cambiarlo", r.candidatos.some((c) => c.alumnoIds.join() === r.elegido?.alumnoIds.join()));
  check("cada candidato trae una razón escrita en cristiano", r.candidatos.every((c) => c.razon.trim().length > 0));
}

console.log("\n8) Repartir una transferencia entre varios: a cada uno LO SUYO");
{
  check("un solo alumno se lleva todo", repartirMonto(60000, [60000]).join() === "60000");
  check("dos hermanas: a cada una su mensualidad, no la mitad", repartirMonto(135000, [60000, 75000]).join() === "60000,75000");
  check("si el monto no cuadra con la suma, se parte en partes iguales", repartirMonto(100000, [60000, 75000]).join() === "50000,50000");
  check("un alumno sin mensualidad cargada no rompe el reparto", repartirMonto(100000, [60000, 0]).join() === "50000,50000");
  check("el peso que no se puede partir en dos va al primero", repartirMonto(50001, [60000, 60000]).join() === "25001,25000");
  check("sin alumnos no se reparte nada", repartirMonto(60000, []).length === 0);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
