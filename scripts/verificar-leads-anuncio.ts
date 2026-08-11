/**
 * ¿El primer mensaje de un anuncio se queda sin respuesta? — CONTRA EL MODELO REAL.
 *
 * Es la medición de Medifis #51 traída a Arteluk: allí 6 a 8 de cada 14 leads de
 * campaña se quedaban mudos porque el modelo metía la plantilla de Meta en el saco de
 * los mensajes que no se contestan. Aquí el filtro de entrada es todavía más duro
 * ("ante la duda, silencia"), así que había que medirlo, no suponerlo.
 *
 * Gasta tokens (Haiku, unos centavos). No toca WhatsApp ni la base.
 *   npx tsx scripts/verificar-leads-anuncio.ts [vueltas]
 */
import "./env-loader.js";
import { responderEnsayo, resumenUso, type TurnoEnsayo } from "../src/lib/ensayo.js";

// Los primeros mensajes tal como llegan de verdad: cortos, sin pregunta y con las
// plantillas que rellena Meta o Instagram.
const PRIMEROS_MENSAJES = [
  "Quiero resolver una duda (anuncio)",
  "Hola, quiero información",
  "Más información",
  "Vi su publicación",
  "Hola 👋",
];

// El silencio SÍ tiene que seguir funcionando para lo de siempre: la vida personal
// de Mary y el que cierra la conversación.
const DEBEN_SEGUIR_CALLADOS = [
  "hola Mary como estai, llegas a almorzar?",
  "feliz cumpleee 🎉🎉",
];

const vueltas = Math.max(1, Number(process.argv[2]) || 3);

let mudos = 0, contestados = 0, callosCorrectos = 0, callosFallidos = 0;
const arranque = Date.now();

console.log(`\n🎯 ¿Se queda mudo el lead del anuncio? — ${vueltas} vueltas por mensaje\n`);

for (const texto of PRIMEROS_MENSAJES) {
  for (let i = 0; i < vueltas; i++) {
    const turnos: TurnoEnsayo[] = [{ rol: "apoderado", texto }];
    const r = await responderEnsayo(turnos);
    const callo = !r.texto.trim();
    const silencio = r.acciones.some((a) => a.includes("no es del taller"));
    if (callo || silencio) {
      mudos++;
      console.log(`  ❌ "${texto}" → SIN RESPUESTA${silencio ? " (llamó a silenciar)" : " (texto vacío)"}`);
    } else {
      contestados++;
      if (i === 0) console.log(`  ✅ "${texto}" → "${r.texto.replace(/\s+/g, " ").slice(0, 90)}…"`);
    }
  }
}

console.log("\n— y el silencio que SÍ tiene que seguir funcionando —");
for (const texto of DEBEN_SEGUIR_CALLADOS) {
  const r = await responderEnsayo([{ rol: "apoderado", texto }]);
  const silencio = r.acciones.some((a) => a.includes("no es del taller")) || !r.texto.trim();
  if (silencio) { callosCorrectos++; console.log(`  ✅ "${texto}" → se queda callado, como debe`); }
  else { callosFallidos++; console.log(`  ❌ "${texto}" → CONTESTÓ: "${r.texto.slice(0, 80)}…"`); }
}

const total = mudos + contestados;
console.log(`\n📊 leads de anuncio: ${contestados}/${total} contestados · ${mudos} mudos`);
console.log(`   vida personal: ${callosCorrectos}/${callosCorrectos + callosFallidos} en silencio`);
console.log(resumenUso(Date.now() - arranque));

const ok = mudos === 0 && callosFallidos === 0;
console.log(`\n${ok ? "🎉 ningún lead de anuncio se quedó sin respuesta" : "⚠️ hay leads perdidos"}\n`);
process.exit(ok ? 0 : 1);
