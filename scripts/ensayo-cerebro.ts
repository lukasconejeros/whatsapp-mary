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
  // 10-08 tarde: acá el bot le calcó a Mary su propio párrafo, palabra por palabra.
  "mi hija es muy tímida y le cuesta socializar",
  "ustedes trabajan con psicólogos?",                 // dato que Mary dio y no se había bajado
  "ya sabes qué, sí quiero llevarla. qué días tienen?",  // horarios sin confirmar: NO los da
  "me pasas los datos para transferir?",              // el único caso, con los horarios, que va en líneas
  "soy Carolina y mi hija es Emilia",                 // ya tiene los datos: acá debe derivar
  "oye y estoy hablando con una persona o con un bot?",
];

// Los textos que escribió Mary son la INFORMACIÓN y el tono, no un molde para copiar y
// pegar. Si alguna de estas frases sale calcada, el bot está repitiendo en vez de hablar.
const CALCOS = [
  "vamos generando espacios para que socialicen de manera natural",
  "fortaleciendo habilidades de autorregulación mientras crea su propia obra",
  "para que aprendan a comprender y utilizar el color de manera consciente",
  "conocer distintos estilos y referentes del arte",
  "la clase se considerará igualmente realizada",
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

    // 10-08 (tarde) — Lukas, viendo lo que Mary volvió a practicar: "no debería responder
    // en párrafos con - ni ; ni :, tiene que acortar para sonar como una persona".
    if (/[—–]/.test(r.texto)) mal("usó raya larga (—), eso no lo escribe nadie por WhatsApp");
    if (r.texto.includes(";")) mal("usó punto y coma");
    if (/\s-\s/.test(r.texto)) mal("usó un guion suelto como separador");
    // Las horas (17:30) son lo único que puede llevar dos puntos.
    if (r.texto.replace(/\d{1,2}:\d{2}/g, "").includes(":")) mal("usó dos puntos para presentar algo");

    const calco = CALCOS.find((c) => r.texto.toLowerCase().includes(c));
    if (calco) mal(`calcó el texto de Mary en vez de contarlo ("${calco.slice(0, 45)}…")`);

    // Techo duro de 3-4 líneas SIEMPRE, incluso si preguntan por el método (lo eligió
    // Lukas el 10-08). Las únicas que van en líneas son los horarios y los datos para
    // transferir: en prosa corrida se leen peor.
    const vaEnLineas = /qué días|horarios|transferir|datos bancarios/i.test(texto);
    const topeLineas = vaEnLineas ? 10 : 4;
    const topeChars = vaEnLineas ? 550 : 400;
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
    if (texto.includes("tímida")) {
      /grupo|conversa|socializ|confianza|de a poco|de a poquito/i.test(r.texto)
        ? bien("contesta el fondo de la timidez, con sus palabras")
        : mal("no contestó lo de la timidez");
    }
    // Mary contó que trabajan con una psicóloga y dejó su contacto. El bot lo cuenta,
    // pero el teléfono y el Instagram de una tercera persona los entrega ella.
    if (texto.includes("psicólogos")) {
      /psic[oó]log/i.test(r.texto) ? bien("cuenta que sí trabajan con una psicóloga") : mal("esquivó lo de la psicóloga");
      /9120\s?8051|99120|instagram\.com/i.test(r.texto) && mal("entregó el contacto de la psicóloga (lo da Mary)");
      r.acciones.some((a) => a.includes("pasado la conversación"))
        ? bien("pasa con Mary para el contacto")
        : mal("no derivó a Mary para dar el contacto");
    }
    if (texto.includes("transferir")) {
      r.texto.includes("1098729145") ? bien("da el número de cuenta") : mal("no dio el número de cuenta");
      r.texto.includes("78.387.831-3") ? bien("da el RUT de la empresa") : mal("no dio el RUT");
    }
    // Los horarios que confirmó Mary el 10-08. Para una niña de 8 años van los de lunes a
    // jueves; viernes y sábado son el grupo de adolescentes y NO le sirven.
    if (texto.includes("qué días")) {
      /lunes|martes|mi[ée]rcoles|jueves/i.test(r.texto)
        ? bien("le da los horarios de niños")
        : mal("no le dio ningún horario");
      // 10-08: le dio solo lunes y jueves. Martes y miércoles también son de niños, y el
      // que se calla puede ser justo el que a esa mamá le calzaba.
      const faltan = ["lunes", "martes", "miércoles", "jueves"].filter((d) =>
        !new RegExp(d.replace("é", "[eé]"), "i").test(r.texto));
      faltan.length ? mal(`se comió días de niños: ${faltan.join(", ")}`) : bien("le da los cuatro días de niños");
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
