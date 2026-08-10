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
  // Las 5 de abajo son preguntas REALES de Mary entrenando el 10-08, con las respuestas
  // que ella misma corrigió. Cada una tenía el dato equivocado en el cerebro viejo.
  "dónde están ubicados?",                           // decía Picarte 407: es 805
  "desde qué edad reciben?",                          // decía "desde los 7": es desde los 5
  "ustedes trabajan arteterapia?",                    // decía que NO: sí hacen
  "cuál es su metodología?",                          // contestaba media frase y volvía a la edad
  "ya sabes qué, sí quiero llevarla. qué días tienen?",  // horarios sin confirmar: NO los da
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

    // 10-08: estilo híbrido. Cuando le preguntan por el MÉTODO, Mary escribe párrafos
    // largos y eso es lo que convence, así que ahí se permite; en todo lo demás sigue
    // mandando el mensaje corto de WhatsApp.
    // La lista de horarios ocupa líneas por definición (Mary los escribe uno por línea).
    const esPreguntaDeMetodo = /metodolog|arteterapia|técnicas|tecnicas|qué días/i.test(texto);
    // El tope de 400 venía del estilo seco anterior; las respuestas de Mary pasan de 400
    // ellas solas, así que el normal sube a 500 y el de método a 900.
    const topeLineas = esPreguntaDeMetodo ? 10 : 5;
    const topeChars = esPreguntaDeMetodo ? 900 : 500;
    if (lineas > topeLineas) mal(`respuesta larga (${lineas} líneas)`);
    if (r.texto.length > topeChars) mal(`respuesta muy larga (${r.texto.length} caracteres)`);

    const jerga = JERGA.filter((j) => r.texto.toLowerCase().includes(j));
    if (jerga.length) mal(`usó jerga que no es de Mary: ${jerga.join(", ")}`);
    if (/qu[eé]r[eé]s|ten[eé]s|pod[eé]s/i.test(r.texto)) mal("usó voseo argentino");

    // Los datos que Mary corrigió: si vuelven los viejos, un apoderado recibe algo falso.
    if (texto.includes("ubicados")) {
      r.texto.includes("805") ? bien("da la dirección corregida (Picarte 805)") : mal("no dio Picarte 805");
      if (r.texto.includes("407")) mal("dio la dirección VIEJA (Picarte 407)");
    }
    if (texto.includes("qué edad")) {
      /\b5\b|cinco/i.test(r.texto) ? bien("dice desde los 5 años") : mal("no dijo que reciben desde los 5 años");
      if (/desde los 7|desde los siete/i.test(r.texto)) mal("volvió a decir 'desde los 7'");
    }
    if (texto.includes("arteterapia")) {
      /no (hac|trabaj|ten)/i.test(r.texto) ? mal("dijo que NO hacen arteterapia") : bien("no negó la arteterapia");
    }
    // Los horarios que confirmó Mary el 10-08. Para una niña de 8 años van los de lunes a
    // jueves; viernes y sábado son el grupo de adolescentes y NO le sirven.
    if (texto.includes("qué días")) {
      /lunes|martes|mi[ée]rcoles|jueves/i.test(r.texto)
        ? bien("le da los horarios de niños")
        : mal("no le dio ningún horario");
      /viernes|s[áa]bado/i.test(r.texto) && mal("le ofreció el grupo de adolescentes a una niña de 8");
      /domingo/i.test(r.texto) && mal("inventó el domingo, que no existe");
      // Los únicos horarios que existen. Cualquier otra hora es inventada.
      const horas = r.texto.match(/\d{1,2}:\d{2}/g) ?? [];
      const validas = ["16:00", "17:00", "17:30", "19:30", "11:00", "13:00"];
      const inventadas = horas.filter((h) => !validas.includes(h));
      inventadas.length ? mal(`inventó horas que no existen: ${inventadas.join(", ")}`) : bien("no inventó ninguna hora");
    }

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
