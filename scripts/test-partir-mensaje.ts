/**
 * UN MENSAJE = UNA IDEA.
 *
 * Encargo de Lukas (08-09-2026), salido de la auditoría de estilo: Mary manda ideas sueltas y
 * cortas; el bot mandaba parrafones. Medido sobre los 114 mensajes que el bot escribió en
 * producción: 44 llevaban 2 o más párrafos en la MISMA burbuja y 20 llevaban 3 o más. Una
 * clienta lo dijo con todas sus letras (conv 395): *"me agotó y me confundió"*.
 *
 * Lo que se parte y lo que NO:
 *  - Se parte por PÁRRAFOS (línea en blanco), nunca por frases: partir por puntos deja
 *    burbujas cortadas a la mitad y el bot deja de sonar a persona.
 *  - Los bloques de líneas seguidas (los horarios, los datos del banco) NO se tocan: van
 *    juntos en una sola burbuja porque así se leen.
 *  - TOPE DURO DE 3 MENSAJES por respuesta. Es anti-baneo: una ráfaga de burbujas seguidas
 *    al mismo número es justo lo que WhatsApp castiga. Si hay más párrafos, se juntan.
 *  - Nada se pierde por el camino: la unión de los trozos tiene que traer todo el texto.
 *
 *   npx tsx scripts/test-partir-mensaje.ts
 */
import { partirEnMensajes, retrasosDeEnvio, MAX_MENSAJES } from "../src/lib/partir-mensaje";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); pass++; }
  else { console.log(`  ❌ ${msg}`); fail++; }
}

// Cuenta las palabras que sobreviven al partido: sirve para probar que no se pierde nada
// sin pelearse con los saltos de línea.
const palabras = (s: string) => s.replace(/\s+/g, " ").trim();

console.log("\n🧪 Un mensaje = una idea (partir la respuesta del bot)\n");

console.log("— lo que NO se toca —");
ok(partirEnMensajes("").length === 0, "texto vacío no encola nada");
ok(partirEnMensajes("   \n  ").length === 0, "texto en blanco no encola nada");

const corto = "Perfecto 😊 A los 8 años trabajan dibujo y pintura, y van aprendiendo de a poco.";
ok(partirEnMensajes(corto).length === 1, "un solo párrafo sale como un solo mensaje");
ok(partirEnMensajes(corto)[0] === corto, "y sale tal cual, sin tocarle una letra");

console.log("\n— dos ideas, dos burbujas —");
const dos = "Trabajamos con la Metodología Arteluk 🎨 Aprenden técnicas paso a paso.\n\n¿Para quién sería la clase?";
const p2 = partirEnMensajes(dos);
ok(p2.length === 2, "dos párrafos salen como dos mensajes");
ok(p2[0] === "Trabajamos con la Metodología Arteluk 🎨 Aprenden técnicas paso a paso.", "el primero es la idea");
ok(p2[1] === "¿Para quién sería la clase?", "el segundo es la pregunta");
ok(!p2.some((t) => /\n\s*\n/.test(t)), "ningún trozo se queda con la línea en blanco dentro");

console.log("\n— los horarios se mandan enteros, no una línea por burbuja —");
const horarios =
  "¡Qué bueno! 😊 Para una niña de 8 años tenemos estos horarios 🎨\n\n" +
  "🖌 Lunes 16:00 a 17:00 y 17:30 a 19:30\n" +
  "🎨 Martes 17:30 a 19:30\n" +
  "🌈 Miércoles 17:30 a 19:30\n" +
  "🖍 Jueves 16:00 a 17:00 y 17:30 a 19:30\n\n" +
  "Puede elegir el horario que mejor les acomode 😊";
const ph = partirEnMensajes(horarios);
ok(ph.length === 3, "intro, lista y cierre son tres mensajes");
ok(ph[1].split("\n").length === 4, "los cuatro días viajan juntos en una sola burbuja");
ok(palabras(ph.join(" ")) === palabras(horarios), "no se pierde ni una palabra de los horarios");

console.log("\n— el tope de 3, que es anti-baneo —");
const cinco = [
  "Hola, qué gusto 😊 Cuénteme para quién sería la clase.",
  "En Arteluk trabajamos con grupos chicos, de máximo seis niños.",
  "La clase de prueba son dos horas con todos los materiales incluidos.",
  "Estamos en Picarte 804, en el segundo piso al lado del Registro Civil.",
  "¿Le gustaría que le cuente los horarios que tenemos?",
].join("\n\n");
const p5 = partirEnMensajes(cinco);
ok(p5.length === MAX_MENSAJES, `cinco párrafos se juntan hasta quedar en ${MAX_MENSAJES} mensajes`);
ok(p5.length <= 3, "nunca más de 3 burbujas seguidas");
ok(palabras(p5.join(" ")) === palabras(cinco), "los cinco párrafos siguen enteros, solo reagrupados");
ok(p5.every((t) => t.trim().length > 0), "ningún trozo vacío");

console.log("\n— las coletillas no salen solas —");
const coletilla = "La clase de prueba son dos horas con todos los materiales incluidos 🎨\n\n😊";
const pc = partirEnMensajes(coletilla);
ok(pc.length === 1, "un emoji suelto no se manda como burbuja aparte");
ok(pc[0].includes("😊"), "pero el emoji no se pierde");

console.log("\n— la pausa entre burbujas —");
const r1 = retrasosDeEnvio(["hola"]);
ok(r1.length === 1 && r1[0] === 0, "un solo mensaje sale al tiro");
const r3 = retrasosDeEnvio(ph);
ok(r3[0] === 0, "el primero de una tanda también sale al tiro");
ok(r3[1] > r3[0] && r3[2] > r3[1], "cada burbuja siguiente espera más que la anterior");
ok(r3[1] >= 4, "la espera mínima entre burbujas es de al menos 4 segundos (parece que escribe)");
ok(r3[r3.length - 1] <= 40, "y la tanda entera nunca pasa de 40 segundos");
const trasCorta = retrasosDeEnvio(["hola", "chao"])[1];
const trasLarga = retrasosDeEnvio(["x".repeat(400), "chao"])[1];
ok(trasLarga > trasCorta, "después de una burbuja larga espera más: la pausa la marca lo que ya escribió");

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
