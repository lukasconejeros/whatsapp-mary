// El parser de la respuesta de Mary al pase de lista de las 21:00.
// Sin IA a propósito: es una tarea cerrada (la lista de nombres del día ya se
// conoce), sale gratis y NUNCA inventa un alumno.
//
// La regla de oro que prueban estos casos: ante la duda NO se adivina, se
// pregunta. Marcar mal a un niño es peor que volver a preguntar.
import { interpretarPaseLista, normalizar, type Lectura } from "../src/lib/pase-lista.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const A = ["Mateo", "Matilda", "Sofía", "Tomás"];

function igual(nombre: string, real: Lectura, esperado: Lectura) {
  const orden = (l: Lectura) =>
    l.tipo === "ok" ? { tipo: l.tipo, vino: [...l.vino].sort(), falto: [...l.falto].sort() } : l;
  check(nombre, JSON.stringify(orden(real)) === JSON.stringify(orden(esperado)), JSON.stringify(real));
}

console.log("Vinieron todos");
igual("«sí»", interpretarPaseLista("sí", A), { tipo: "ok", vino: A, falto: [] });
igual("«si»", interpretarPaseLista("si", A), { tipo: "ok", vino: A, falto: [] });
igual("«sip»", interpretarPaseLista("sip", A), { tipo: "ok", vino: A, falto: [] });
igual("«todos»", interpretarPaseLista("todos", A), { tipo: "ok", vino: A, falto: [] });
igual("«vinieron todos»", interpretarPaseLista("vinieron todos", A), { tipo: "ok", vino: A, falto: [] });
igual("«sí, todos vinieron»", interpretarPaseLista("sí, todos vinieron", A), { tipo: "ok", vino: A, falto: [] });
igual("«no faltó nadie»", interpretarPaseLista("no faltó nadie", A), { tipo: "ok", vino: A, falto: [] });

console.log("\nFaltó alguien");
igual("«no fue Mateo»", interpretarPaseLista("no fue Mateo", A),
  { tipo: "ok", vino: ["Matilda", "Sofía", "Tomás"], falto: ["Mateo"] });
igual("«faltó Mateo»", interpretarPaseLista("faltó Mateo", A),
  { tipo: "ok", vino: ["Matilda", "Sofía", "Tomás"], falto: ["Mateo"] });
igual("«no vino Tomás hoy»", interpretarPaseLista("no vino Tomás hoy", A),
  { tipo: "ok", vino: ["Mateo", "Matilda", "Sofía"], falto: ["Tomás"] });
igual("«faltaron Mateo y Sofia»", interpretarPaseLista("faltaron Mateo y Sofia", A),
  { tipo: "ok", vino: ["Matilda", "Tomás"], falto: ["Mateo", "Sofía"] });
igual("«todos menos Tomás»", interpretarPaseLista("todos menos Tomás", A),
  { tipo: "ok", vino: ["Mateo", "Matilda", "Sofía"], falto: ["Tomás"] });
igual("sin tildes: «falto sofia»", interpretarPaseLista("falto sofia", A),
  { tipo: "ok", vino: ["Mateo", "Matilda", "Tomás"], falto: ["Sofía"] });
igual("mayúsculas: «NO FUE MATILDA»", interpretarPaseLista("NO FUE MATILDA", A),
  { tipo: "ok", vino: ["Mateo", "Sofía", "Tomás"], falto: ["Matilda"] });

console.log("\nNo vino nadie");
igual("«no vino nadie»", interpretarPaseLista("no vino nadie", A), { tipo: "ok", vino: [], falto: A });
igual("«ninguno»", interpretarPaseLista("ninguno", A), { tipo: "ok", vino: [], falto: A });

console.log("\nCuando NO se entiende (no adivina)");
igual("nombre que no es de hoy", interpretarPaseLista("no fue Benjamín", A), { tipo: "no-entendi" });
igual("ambigua: «vino solo Mateo»", interpretarPaseLista("vino solo Mateo", A), { tipo: "no-entendi" });
igual("vacía", interpretarPaseLista("   ", A), { tipo: "no-entendi" });
igual("otra conversación", interpretarPaseLista("oye y la cuenta del arriendo?", A), { tipo: "no-entendi" });
igual("un audio ininteligible", interpretarPaseLista("mmm eeeh", A), { tipo: "no-entendi" });
igual("sin alumnos que preguntar", interpretarPaseLista("sí", []), { tipo: "no-entendi" });

console.log("\nDetalles");
check("normalizar quita tildes y signos", normalizar("¿No fue Sofía?") === "no fue sofia", normalizar("¿No fue Sofía?"));
igual("apellido: basta el primer nombre", interpretarPaseLista("no vino sofia", ["Sofía Pérez", "Mateo"]),
  { tipo: "ok", vino: ["Mateo"], falto: ["Sofía Pérez"] });
igual("no confunde nombres dentro de otra palabra", interpretarPaseLista("no vino tomasa", ["Tomás"]),
  { tipo: "no-entendi" });

console.log(`\n${pass} bien, ${fail} mal`);
process.exit(fail === 0 ? 0 : 1);
