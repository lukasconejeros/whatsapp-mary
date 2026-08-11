// Las horas y los textos de los dos avisos nuevos de Mary. Todo puro: entra la
// hora por parámetro, así se prueba cualquier momento del día sin esperar.
import {
  tocaAviso, textoResumen, textoPaseLista, textoNoEntendi,
  textoConfirmacion, textoMeRindo, HORA_RESUMEN_DIA, HORA_PASE_LISTA,
} from "../src/lib/avisos-mary.js";
import type { ItemDia } from "../src/lib/dia-de-mary.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("A qué hora sale el resumen (10:00 + 3 h de gracia)");
check("las horas son las que pidió Lukas", HORA_RESUMEN_DIA === 10 && HORA_PASE_LISTA === 21);
check("09:59 todavía no", tocaAviso("resumen", "09:59") === false);
check("10:00 sí", tocaAviso("resumen", "10:00") === true);
check("12:59 sí (el bot pudo estar caído)", tocaAviso("resumen", "12:59") === true);
check("13:01 ya no (sería ruido a deshora)", tocaAviso("resumen", "13:01") === false);
check("las 21:00 no disparan el resumen", tocaAviso("resumen", "21:00") === false);

console.log("\nY el pase de lista (21:00)");
check("20:59 todavía no", tocaAviso("pase-lista", "20:59") === false);
check("21:00 sí", tocaAviso("pase-lista", "21:00") === true);
check("23:59 sí", tocaAviso("pase-lista", "23:59") === true);
check("00:10 del otro día ya no", tocaAviso("pase-lista", "00:10") === false);
check("hora inválida no dispara nada", tocaAviso("pase-lista", "no es una hora") === false);

console.log("\nEl mensaje de las 10:00");
const items: ItemDia[] = [
  { hora: "09:00", texto: "comprar arcilla", tipo: "recordatorio" },
  { hora: "16:00", texto: "Mary · Mateo, Matilda", tipo: "clase" },
  { hora: "18:00", texto: "Paula · Sofía", tipo: "clase" },
  { hora: null, texto: "arriendo $350.000", tipo: "pago" },
];
const r = textoResumen("2026-08-11", items);
console.log(r.split("\n").map((l) => `      ${l}`).join("\n"));
check("dice qué día es", r.includes("martes 11"), r);
check("trae las 4 cosas", ["comprar arcilla", "Mateo, Matilda", "Sofía", "arriendo"].every((t) => r.includes(t)));
check("respeta el orden que le entregan", r.indexOf("arcilla") < r.indexOf("Mateo") && r.indexOf("Mateo") < r.indexOf("Sofía"));
check("marca los recordatorios y los pagos", r.includes("⏰") && r.includes("💸"));
check("sin líneas vacías", r.split("\n").every((l) => l.trim().length > 0), JSON.stringify(r));

console.log("\nEl mensaje de las 21:00");
const p3 = textoPaseLista(["Mateo", "Matilda", "Sofía"]);
console.log(`      ${p3.replace(/\n/g, "\n      ")}`);
check("nombra a los tres", ["Mateo", "Matilda", "Sofía"].every((n) => p3.includes(n)));
check("con «y» antes del último", p3.includes("Matilda y Sofía"), p3);
check("y pregunta", p3.includes("?"));
const p1 = textoPaseLista(["Mateo"]);
check("con uno solo habla en singular", p1.includes("Hoy tenías a Mateo") && !p1.includes("todos"), p1);

console.log("\nLo que le responde después");
check("si vinieron todos", textoConfirmacion(["Mateo", "Sofía"], []).includes("todos"));
check("si faltó uno, lo nombra", textoConfirmacion(["Sofía"], ["Mateo"]).includes("Mateo"));
check("si faltaron dos, los nombra a los dos", ["Mateo", "Sofía"].every((n) => textoConfirmacion(["Tomás"], ["Mateo", "Sofía"]).includes(n)),
  textoConfirmacion(["Tomás"], ["Mateo", "Sofía"]));
check("si no fue ninguno, lo dice corto", textoConfirmacion([], ["Mateo", "Sofía"]).includes("nadie"));
check("cuando no entiende, pide los nombres", textoNoEntendi().toLowerCase().includes("nombres"));
check("cuando se rinde, manda al calendario", textoMeRindo().toLowerCase().includes("calendario"));

console.log(`\n${pass} bien, ${fail} mal`);
process.exit(fail === 0 ? 0 : 1);
