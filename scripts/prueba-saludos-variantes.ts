// BARRIDO del saludo por hora contra todo lo que Mary podría escribir en la caja (24-08-2026).
//
// Encargo de Lukas: "hazle varias pruebas para asegurarte de que funcione, intenta encontrar los
// bugs conversacionales". Esto no llama al modelo (no cuesta nada): recorre el camino que sí toma
// cada mensaje real de un lead nuevo — el saludo sale sin pasar por la IA — con 30 formas distintas
// de escribir el saludo, en las 3 franjas del día, y revisa cómo queda el texto que lee la mamá.
//
//   npx tsx scripts/prueba-saludos-variantes.ts
import "./env-loader.js";
import { conSaludoDeHora, setBienvenida, getBienvenida, saludoDeEntrada } from "../src/lib/mensajes.js";
import { detectarTuteo } from "../src/lib/antituteo.js";
import type { Message } from "../src/lib/db.js";

let pass = 0, fail = 0;
const problemas: string[] = [];
function check(n: string, ok: boolean, extra = "") {
  if (!ok) { fail++; problemas.push(`${n} → ${extra}`); } else pass++;
}

// Cómo podría escribir Mary su saludo. Incluye lo que tiene guardado hoy en producción.
const VARIANTES = [
  "hola como esta! un gusto, mi nombre es Mary Quinteros, profesora de la academia Arteluk desde hace 5 años, cuénteme cuál es su nombre y para quién sería la clase?",
  "¡Hola! 😊 Soy Mary Quinteros, directora de Academia Arteluk. Cuénteme, ¿para quién sería la clase?",
  "hola buenas un gusto, soy Mary de Arteluk",
  "Hola, ¿cómo está? Soy Mary de la academia Arteluk",
  "Hola! Cómo estás? Soy Mary",
  "buenas tardes, soy Mary Quinteros",
  "Buenos días, le saluda Mary de Arteluk",
  "buenas noches! soy Mary",
  "Buen día, soy Mary de Arteluk",
  "¿Qué tal? Soy Mary, profesora de arte",
  "Holaaa!! 😊 soy Mary",
  "holis, soy Mary",
  "hola hola, soy Mary de Arteluk",
  "Hola 🎨 Soy Mary y enseño arte en Valdivia",
  "😊 Soy Mary de Arteluk, dígame para quién sería la clase",
  "Soy Mary Quinteros, directora de Academia Arteluk.",
  "Mary Quinteros, Academia Arteluk. ¿Para quién sería la clase?",
  "hola",
  "Hola!",
  "buenas",
  "hola, ¿cómo le va? soy Mary",
  "Hola, cómo están? Soy Mary de Arteluk",
  "hola como estai, soy Mary",
  "   hola,   soy Mary   ",
  "HOLA! SOY MARY DE ARTELUK",
  "hola. soy Mary. enseño arte hace 5 años.",
  "Hola: soy Mary de Arteluk",
  "hola- soy Mary",
  "Hola, un gusto. Soy Mary Quinteros, magíster en psicología.",
  "Bienvenida a Arteluk, soy Mary",
];

const HORAS = [9, 15, 22];
const filas: string[] = [];

for (const v of VARIANTES) {
  for (const h of HORAS) {
    const r = conSaludoDeHora(v, h);
    const et = `«${v.slice(0, 32)}…» ${h}h`;

    // 1. Siempre abre con el saludo de la hora, y con el correcto.
    const esperado = h === 9 ? "Buenos días" : h === 15 ? "Buenas tardes" : "Buenas noches";
    check(`${et}: abre con ${esperado}`, r.startsWith(esperado), r.slice(0, 45));

    // 2. Nunca quedan dos saludos pegados ("Buenas tardes. Hola, soy Mary").
    check(`${et}: no deja un segundo saludo`, !/\b(hola+|buenas|buenos d[ií]as|qu[eé] tal)\b/i.test(r.slice(esperado.length)), r.slice(0, 60));

    // 3. Nunca pregunta cómo está (es justo lo que Lukas no quiere).
    check(`${et}: no pregunta cómo está`, !/c[oó]mo\s+(est[aá]s?|estai|est[aá]n|le va)/i.test(r), r.slice(0, 60));

    // 4. Nada de signos huérfanos ni dobles espacios donde se cortó.
    check(`${et}: sin signos sueltos al empezar`, !/^[^A-Za-zÁÉÍÓÚÑ]*[,;:!?]{1}\s/.test(r.slice(esperado.length + 2)), r.slice(0, 50));
    check(`${et}: sin espacios dobles`, !/ {2}/.test(r), JSON.stringify(r.slice(0, 50)));

    // 5. El cuerpo de lo que ella escribió no se pierde (si escribió algo más que el saludo).
    const cuerpo = v.replace(/[^a-záéíóúñ ]/gi, " ").split(/\s+/).filter((p) => p.length > 4 && !/hola|holis|buenas|buenos|tardes|noches|estai|est[aá]s|est[aá]n|saluda/i.test(p));
    if (cuerpo.length) {
      check(`${et}: no se come lo que ella escribió`, cuerpo.every((p) => r.toLowerCase().includes(p.toLowerCase())), `falta «${cuerpo.filter((p) => !r.toLowerCase().includes(p.toLowerCase())).join(", ")}» en «${r.slice(0, 60)}»`);
    }

    if (h === 15) filas.push(`  ${v.length > 46 ? v.slice(0, 46) + "…" : v.padEnd(47)}  →  ${r.length > 62 ? r.slice(0, 62) + "…" : r}`);
  }
}

console.log("\n🧪 BARRIDO: 30 formas de escribir el saludo × 3 horas del día\n");
console.log("Lo que leería la mamá a las 15:00 (una fila por variante):\n");
filas.forEach((f) => console.log(f));

// ── Y el camino completo, el que de verdad recorre un lead de Meta ───────────
console.log("\n— el camino real del lead de Meta, con el saludo guardado hoy en producción —");
const original = getBienvenida();
const REAL = VARIANTES[0];
setBienvenida(REAL);
let seq = 0;
const msg = (role: Message["role"], content: string): Message =>
  ({ id: ++seq, conversation_id: 900, role, content, created_at: Date.now(), media: null });

const salida = saludoDeEntrada([msg("user", "¡Hola! Quiero más información")]).texto;
console.log(`  ${salida}`);
const tuteos = detectarTuteo(salida);
check("el primer mensaje a un lead nuevo NO tutea", tuteos.length === 0, JSON.stringify(tuteos));
setBienvenida(original);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} comprobaciones ok, ${fail} fallando`);
if (problemas.length) {
  console.log("\nProblemas encontrados:");
  problemas.slice(0, 20).forEach((p) => console.log(`  · ${p}`));
  if (problemas.length > 20) console.log(`  … y ${problemas.length - 20} más`);
}
process.exit(fail === 0 ? 0 : 1);
