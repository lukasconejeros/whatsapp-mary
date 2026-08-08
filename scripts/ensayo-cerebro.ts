/**
 * Arnés de ensayo del cerebro de Arteluk.
 *
 * Corre una conversación completa contra el modelo REAL con el cerebro real
 * (`prompts/negocio.md`), con el guion de una mamá interesada, y marca si se respeta
 * la regla de oro: NO soltar toda la información de una.
 *
 * No toca WhatsApp ni la base: usa el motor de ensayo, que simula las herramientas.
 *   npx tsx scripts/ensayo-cerebro.ts
 */
import "./env-loader.js";
import { responderEnsayo, demoraEnsayoMs, type TurnoEnsayo } from "../src/lib/ensayo.js";

const GUION = [
  "Hola, quiero información",                        // el mensaje que hoy mata la conversación
  "es para mi hija",
  "tiene 8 años",
  "ya, y cuánto sale?",
  "mmm ya, lo voy a pensar y te aviso",              // el "lo pienso" que hace perder al alumno
  "ya sabes qué, sí quiero llevarla. qué días tienen?",
  "soy Carolina y mi hija es Emilia",                 // ya tiene los datos: acá debe derivar
  "oye y estoy hablando con una persona o con un bot?",
];

const JERGA = ["bacán", "bacan", "filete", "la raja", "sipo", "cachai"];

const PRECIOS = ["19.990", "45.000", "60.000", "120.000", "15.000"];

let fallos = 0;
function mal(msg: string) { console.log(`   ❌ ${msg}`); fallos++; }
function bien(msg: string) { console.log(`   ✅ ${msg}`); }

async function main() {
  console.log(`\n🎭 Ensayo del cerebro de Arteluk (demora del ensayo: ${Math.round(demoraEnsayoMs() / 1000)} s por respuesta)\n`);
  const turnos: TurnoEnsayo[] = [];

  for (const texto of GUION) {
    turnos.push({ rol: "apoderado", texto });
    const r = await responderEnsayo(turnos);
    turnos.push({ rol: "bot", texto: r.texto });

    console.log(`👩 mamá: ${texto}`);
    console.log(`🎨 bot : ${r.texto || "(no respondería nada)"}`);
    r.acciones.forEach((a) => console.log(`         ↳ ${a}`));

    const precios = PRECIOS.filter((p) => r.texto.includes(p));
    const lineas = r.texto.split("\n").filter((l) => l.trim()).length;

    if (texto === "Hola, quiero información") {
      precios.length ? mal(`soltó precios al primer hola: ${precios.join(", ")}`) : bien("no soltó precios al primer hola");
      r.texto.includes("?") ? bien("devolvió una pregunta") : mal("no preguntó nada de vuelta");
    }
    if (precios.length > 1) mal(`mandó ${precios.length} precios juntos: ${precios.join(", ")}`);
    if (/^\s*[-•*]\s/m.test(r.texto)) mal("usó viñetas o lista");
    if (lineas > 4) mal(`respuesta larga (${lineas} líneas)`);
    if (r.texto.length > 400) mal(`respuesta muy larga (${r.texto.length} caracteres)`);

    const jerga = JERGA.filter((j) => r.texto.toLowerCase().includes(j));
    if (jerga.length) mal(`usó jerga que no es de Mary: ${jerga.join(", ")}`);

    // Puede pedir los datos primero (mejor para Mary), pero con nombre y alumna en la
    // mano ya no hay excusa: tiene que pasarle la conversación.
    if (texto.startsWith("soy Carolina")) {
      r.acciones.some((a) => a.includes("pasado la conversación"))
        ? bien("con los datos en la mano te pasa la conversación")
        : mal("teniendo los datos NO derivó a Mary");
    }
    if (texto.includes("persona o con un bot")) {
      /asistente de ia|asistente ia/i.test(r.texto)
        ? bien("se identifica como el asistente de IA de Mary")
        : mal("no se identificó como asistente de IA");
    }
    console.log("");
  }

  console.log(fallos === 0
    ? "🎉 La conversación respetó la regla de oro\n"
    : `⚠️  ${fallos} fallos de estilo o de regla de oro\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error("💥", e?.message ?? e); process.exit(2); });
