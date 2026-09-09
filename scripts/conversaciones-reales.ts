// CÓMO VAN A SALIR LAS CONVERSACIONES AHORA — contra el modelo de verdad (09-09-2026).
//
// Encargo de Lukas: el PDF de conversaciones de ejemplo, pero con casos REALES corridos y
// validados, no escritos a mano. El PDF anterior (08-09) tenía cinco conversaciones "como
// deberían ser", redactadas por mí. Éste tiene las que de verdad contesta el bot.
//
// Reproduce el camino COMPLETO de un mensaje, igual que `src/lib/baileys/handler.ts`:
//   1) pideDatosParaTransferir → frase fija, se apaga, avisa a Mary (ni se le pregunta al modelo)
//   2) quiereLaClaseDePrueba  → FRASE_ESPERA, se apaga, avisa a Mary
//   3) si no, generateReplyDetallado → partirEnMensajes → 1-3 burbujas
// Y arranca de cero, así que el saludo del panel sale tal cual, como en WhatsApp.
//
// El saludo y los 6 bloques que Mary edita se traen de PRODUCCIÓN (scripts/fixtures/
// arteluk-prod-config.json, bajado del panel con login), no del repo: si no, el PDF mostraría
// precios y horarios que no son los que ella tiene puestos.
//
// Gasta plata de verdad (Haiku 4.5, el modelo de producción). Tope duro abajo; cada llamada
// queda marcada como PRUEBA en gasto_ia.
//
//   npx tsx scripts/conversaciones-reales.ts
import "./env-loader.js";
import fs from "fs";
import path from "path";
import { generateReplyDetallado } from "../src/lib/ai.js";
import { partirEnMensajes } from "../src/lib/partir-mensaje.js";
import {
  pideDatosParaTransferir,
  quiereLaClaseDePrueba,
  yaSeHabloDeLaClaseDePrueba,
  FRASE_ESPERA,
  FRASE_DATOS,
} from "../src/lib/interes-prueba.js";
import { setBienvenida, getBienvenida } from "../src/lib/mensajes.js";
import { setOverrides, getOverrides, type ClaveSeccion } from "../src/lib/secciones-negocio.js";
import { detectarTuteo } from "../src/lib/antituteo.js";
import { getGastoIA, type Message } from "../src/lib/db.js";
import { todaySantiago, monthSantiago } from "../src/lib/fechas.js";

const TOPE_USD = 0.75;

const gastado = () => getGastoIA(todaySantiago(), monthSantiago()).pruebas_usd;
const INICIAL = gastado();
const llevo = () => gastado() - INICIAL;

// ── Lo que hay puesto en producción hoy ─────────────────────────────────────
const PROD = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "scripts/fixtures/arteluk-prod-config.json"), "utf-8")
) as { saludo: string; overrides: Record<string, string> };

const msg = (role: "user" | "assistant", content: string): Message =>
  ({ id: 0, conversation_id: 900, role, content, created_at: Date.now() } as unknown as Message);

// ── Los casos ───────────────────────────────────────────────────────────────
// Las preguntas salen de lo medido en producción el 08-09 sobre 408 conversaciones:
// horarios 118, edades 113, precio 102, cómo pagar 57, mensual 42, materiales 32, dónde 25,
// adolescentes 21, diagnóstico 17, cambiar clase 13.
type Check = { nombre: string; re: RegExp; debe: boolean; en?: "ultima" | "toda" };
type Caso = {
  id: string;
  titulo: string;
  cuando: string;
  porque: string;
  mensajes: string[];
  checks?: Check[];
};

const CASOS: Caso[] = [
  {
    id: "anuncio",
    titulo: "La mamá que llega del anuncio de Instagram",
    cuando: "Lo más común: 43 leads en 13 días llegaron así",
    porque: "Antes pedía el nombre y la edad antes de soltar un solo dato. Ahora contesta y después pregunta.",
    mensajes: [
      "Hola! Quiero más información",
      "es para mi hija de 8 años",
      "y cuanto sale?",
      "que horarios tienen?",
    ],
    checks: [
      { nombre: "dice el precio de la clase de prueba", re: /19[.\s]?990/, debe: true, en: "toda" },
      { nombre: "da días de la semana de verdad", re: /lunes|martes|miércoles|jueves|viernes|sábado/i, debe: true },
    ],
  },
  {
    id: "mensual",
    titulo: "«¿Cuánto es el valor mensual?» — el caso de la señora que dijo que la marearon",
    cuando: "42 personas preguntaron el mensual",
    porque: "El 01-09 el bot le tiró los tres planes de golpe y ella escribió «me agotó y me confundió».",
    mensajes: ["hola", "buenas, cuanto es el valor mensual?", "y el de acuarela en que consiste?"],
    checks: [
      { nombre: "al preguntar por acuarela dice SU precio", re: /45[.\s]?000/, debe: true },
      { nombre: "no le suelta encima los otros dos talleres", re: /60[.\s]?000|120[.\s]?000/, debe: false },
    ],
  },
  {
    id: "prueba",
    titulo: "La clase de prueba, contada bonita — y cuando la pide, entra Mary",
    cuando: "Es la puerta de entrada del taller",
    porque: "Encargo del 08-09: que la primera vez se cuente completa, y de ahí en adelante en una línea.",
    mensajes: [
      "hola, vi que hacen una clase de prueba, como es?",
      "y hay que llevar materiales?",
      "ya, quiero tomar la clase de prueba",
    ],
    checks: [
      { nombre: "cuenta las 2 horas", re: /2 horas|dos horas/i, debe: true, en: "toda" },
      { nombre: "dice que los materiales van incluidos", re: /material/i, debe: true, en: "toda" },
      { nombre: "no se inventa salas ni salones", re: /(sala|sal[oó]n)(es)?\s+(de arte|sensorial|tem[aá]tic)/i, debe: false, en: "toda" },
    ],
  },
  {
    id: "transferir",
    titulo: "Pide los datos para transferir — el bot no los manda nunca",
    cuando: "57 personas preguntaron cómo pagar",
    porque: "Decisión de Lukas del 08-09: la plata la cierra Mary. Ni siquiera se le pregunta al modelo.",
    mensajes: ["hola", "cuanto sale el taller de artes al mes?", "perfecto, me pasa los datos para transferir?"],
    checks: [
      { nombre: "NO manda el RUT de la empresa", re: /78\.?387\.?831/, debe: false, en: "toda" },
      { nombre: "NO manda el número de cuenta", re: /1098729145/, debe: false, en: "toda" },
      { nombre: "NO manda el correo de la cuenta", re: /arteluk\.valdivia@gmail\.com/i, debe: false, en: "toda" },
    ],
  },
  {
    id: "diagnostico",
    titulo: "«Mi hijo tiene autismo» — el bot se calla y espera a Mary",
    cuando: "17 conversaciones traían un diagnóstico",
    porque: "Antes contestaba media página hablando de arteterapia. Eso lo responde Mary, no un robot.",
    mensajes: ["hola", "mi hijo tiene autismo nivel 1, ustedes trabajan con niños asi?"],
  },
  {
    id: "adolescente",
    titulo: "Un taller para adolescentes",
    cuando: "21 conversaciones preguntaron por adolescentes",
    porque: "Es el segmento que más se pierde cuando el bot no da horarios.",
    mensajes: ["hola", "tienen algo para adolescentes? mi hija tiene 15"],
    checks: [{ nombre: "no promete cupo", re: /hay cupo|queda cupo/i, debe: false, en: "toda" }],
  },
  {
    id: "donde",
    titulo: "Dónde están y cómo es el lugar",
    cuando: "25 preguntaron la dirección",
    porque: "La dirección buena es Picarte 804 (se corrigió el 31-08). Y del espacio no puede inventar nada.",
    mensajes: ["hola", "donde estan ubicados?", "y como es el lugar? tienen salas especiales?"],
    checks: [
      { nombre: "dice Picarte 804", re: /picarte\s*804/i, debe: true, en: "toda" },
      { nombre: "no se inventa las salas", re: /(sala|sal[oó]n)(es)?\s+(de arte|sensorial|tem[aá]tic)/i, debe: false, en: "toda" },
    ],
  },
  {
    id: "premium",
    titulo: "Preguntan por UN taller: va ese entero",
    cuando: "Encargo del 08-09",
    porque: "«Que le dé todos los detalles, los que aparecen en la página web igual» — sin soltar los otros.",
    mensajes: ["hola", "en que consiste el taller premium?"],
    checks: [
      { nombre: "dice el precio del premium", re: /120[.\s]?000/, debe: true },
      { nombre: "no suelta los otros dos", re: /45[.\s]?000|60[.\s]?000/, debe: false },
    ],
  },
  {
    id: "caro",
    titulo: "«Está caro»",
    cuando: "La objeción de siempre",
    porque: "Hay que ver que no se ponga a regalar descuentos que Mary no autorizó.",
    mensajes: ["hola", "uf, y no tienen algo mas economico? esta caro"],
    checks: [{ nombre: "no inventa descuentos", re: /descuento del|le hago un \d+%|\d+% de descuento/i, debe: false }],
  },
  {
    id: "cambiar",
    titulo: "No puede ir un día y quiere cambiar la clase",
    cuando: "13 conversaciones",
    porque: "Es de las cosas que solo puede confirmar Mary: el bot no tiene la agenda.",
    mensajes: ["hola", "mi hija no puede ir el martes, se puede cambiar para otro dia?"],
  },
  {
    id: "personal",
    titulo: "Le escribe una amiga, no una clienta",
    cuando: "Es el WhatsApp personal de Mary",
    porque: "El filtro de entrada: si no preguntan por el taller, el bot se apaga en silencio.",
    mensajes: ["hola Mary como has estado! feliz cumple amiga 🎉"],
  },
];

// ── Revisiones que corren en TODAS las respuestas ───────────────────────────
type Resultado = { nombre: string; ok: boolean; detalle: string };

function revisarTanda(texto: string, burbujas: string[]): Resultado[] {
  const out: Resultado[] = [];
  const tuteos = detectarTuteo(texto);
  out.push({ nombre: "trata de usted", ok: tuteos.length === 0, detalle: tuteos.join(", ") });
  out.push({ nombre: "máximo 3 burbujas", ok: burbujas.length <= 3, detalle: `${burbujas.length}` });
  const emojis = (texto.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  out.push({ nombre: "máximo 2 emojis en la tanda", ok: emojis <= 2, detalle: `${emojis}` });
  out.push({ nombre: "sin el 💛 que Mary no usa", ok: !texto.includes("💛"), detalle: "" });
  out.push({
    nombre: "sin datos bancarios",
    ok: !/78\.?387\.?831|1098729145|arteluk\.valdivia@gmail\.com/i.test(texto),
    detalle: "",
  });
  // Decisión de Lukas del 08-09: horarios generales SÍ, cupos NO. El bot no ve la agenda de
  // Mary, así que no puede prometer ni "guardar" nada.
  const cupo = /(guard\w+|reserv\w+|aparta\w+)\s+(un |el |le un |le el )?cupo|hay cupo|queda cupo|tengo cupo/i.exec(texto);
  out.push({ nombre: "no promete ni guarda cupos", ok: cupo === null, detalle: cupo?.[0] ?? "" });
  return out;
}

// ── Correr ──────────────────────────────────────────────────────────────────
const saludoOriginal = getBienvenida();
const overridesOriginales = getOverrides();

setBienvenida(PROD.saludo);
setOverrides(PROD.overrides as Record<ClaveSeccion, string>);

type TurnoSalida =
  | { de: "cliente"; texto: string }
  | { de: "bot"; burbujas: string[]; via: "saludo+ia" | "ia" | "regla-dura"; checks: Resultado[] }
  | { de: "sistema"; texto: string };

const salida: {
  generado: string;
  modelo: string;
  saludo: string;
  costo_usd: number;
  casos: {
    id: string; titulo: string; cuando: string; porque: string;
    turnos: TurnoSalida[]; checks: Resultado[];
  }[];
} = { generado: new Date().toISOString(), modelo: "", saludo: PROD.saludo, costo_usd: 0, casos: [] };

let totalOk = 0, totalFail = 0;

for (const caso of CASOS) {
  if (llevo() > TOPE_USD - 0.05) {
    console.log(`\n⛔ tope de gasto alcanzado antes de «${caso.titulo}»`);
    break;
  }
  console.log(`\n══ ${caso.titulo} ══`);
  const hist: Message[] = [];
  const turnos: TurnoSalida[] = [];
  const checksCaso: Resultado[] = [];
  let todoElTexto = "";
  let ultimaRespuesta = "";
  let apagado = false;

  for (const texto of caso.mensajes) {
    if (apagado) {
      turnos.push({ de: "sistema", texto: "El bot ya está apagado en este chat: de acá en adelante contesta Mary." });
      break;
    }
    console.log(`  👤 ${texto}`);
    turnos.push({ de: "cliente", texto });
    hist.push(msg("user", texto));

    let burbujas: string[] = [];
    let via: "saludo+ia" | "ia" | "regla-dura" = "ia";

    if (pideDatosParaTransferir(texto)) {
      burbujas = [FRASE_DATOS];
      via = "regla-dura";
      apagado = true;
      console.log(`  🤖 ${FRASE_DATOS}   [regla dura, sin llamar al modelo]`);
      turnos.push({ de: "bot", burbujas, via, checks: revisarTanda(FRASE_DATOS, burbujas) });
      hist.push(msg("assistant", FRASE_DATOS));
      turnos.push({ de: "sistema", texto: "El bot se apaga en este chat y le avisa a Mary al teléfono." });
      todoElTexto += "\n" + FRASE_DATOS;
      ultimaRespuesta = FRASE_DATOS;
      continue;
    }
    if (quiereLaClaseDePrueba(texto, yaSeHabloDeLaClaseDePrueba(hist))) {
      burbujas = [FRASE_ESPERA];
      via = "regla-dura";
      apagado = true;
      console.log(`  🤖 ${FRASE_ESPERA}   [regla dura, sin llamar al modelo]`);
      turnos.push({ de: "bot", burbujas, via, checks: revisarTanda(FRASE_ESPERA, burbujas) });
      hist.push(msg("assistant", FRASE_ESPERA));
      turnos.push({ de: "sistema", texto: "El bot se apaga en este chat y le avisa a Mary al teléfono." });
      todoElTexto += "\n" + FRASE_ESPERA;
      ultimaRespuesta = FRASE_ESPERA;
      continue;
    }

    const esPrimerContacto = hist.filter((m) => m.role === "assistant").length === 0;
    const det = await generateReplyDetallado({ history: hist, conversationId: 900, prueba: true });
    if (!det.texto.trim()) {
      console.log(`  🤫 (silencio · motivo: ${det.motivo})`);
      turnos.push({
        de: "sistema",
        texto:
          det.motivo === "silencio_deliberado"
            ? "El bot no escribe nada a propósito y espera a Mary."
            : `Sin respuesta (motivo: ${det.motivo}).`,
      });
      checksCaso.push({
        nombre: "se apaga en silencio a propósito (no como fallo)",
        ok: det.motivo === "silencio_deliberado",
        detalle: String(det.motivo),
      });
      continue;
    }
    burbujas = partirEnMensajes(det.texto);
    via = esPrimerContacto ? "saludo+ia" : "ia";
    console.log(`  🤖 ${det.texto.replace(/\n/g, "\n     ")}\n     [${burbujas.length} burbuja(s) · US$${llevo().toFixed(4)}]`);
    const checks = revisarTanda(det.texto, burbujas);
    turnos.push({ de: "bot", burbujas, via, checks });
    for (const b of burbujas) hist.push(msg("assistant", b));
    todoElTexto += "\n" + det.texto;
    ultimaRespuesta = det.texto;
  }

  for (const c of caso.checks ?? []) {
    const donde = c.en === "toda" ? todoElTexto : ultimaRespuesta;
    const hay = c.re.test(donde);
    checksCaso.push({ nombre: c.nombre, ok: hay === c.debe, detalle: hay ? "aparece" : "no aparece" });
  }
  for (const t of turnos) if (t.de === "bot") checksCaso.push(...t.checks);

  // Lo que más le criticó la auditoría del 01-09: pedir el nombre una y otra vez (52 veces en
  // 114 mensajes; en la conv 383, cinco veces). Se cuenta cuántas tandas lo vuelven a pedir.
  const tandasIA = turnos.filter((t) => t.de === "bot" && t.via !== "regla-dura") as Extract<TurnoSalida, { de: "bot" }>[];
  const pidenNombre = tandasIA.filter((t) => /(su|tu|cuál es el) nombre|cómo se llama/i.test(t.burbujas.join(" ")));
  if (tandasIA.length > 1) {
    checksCaso.push({
      nombre: "no vuelve a pedir el nombre en cada mensaje",
      ok: pidenNombre.length <= 2,
      detalle: `lo pide en ${pidenNombre.length} de ${tandasIA.length} tandas`,
    });
  }
  // El filtro de entrada: a quien no pregunta por el taller, el bot no le escribe nada.
  if (caso.id === "personal") {
    const escribio = turnos.some((t) => t.de === "bot");
    checksCaso.push({
      nombre: "no le contesta a quien no pregunta por el taller",
      ok: !escribio,
      detalle: escribio ? "le mandó el saludo comercial" : "",
    });
  }

  for (const r of checksCaso) {
    if (r.ok) totalOk++;
    else { totalFail++; console.log(`    ❌ ${r.nombre} ${r.detalle}`); }
  }
  console.log(`    ${checksCaso.filter((c) => c.ok).length}/${checksCaso.length} revisiones OK`);

  salida.casos.push({ id: caso.id, titulo: caso.titulo, cuando: caso.cuando, porque: caso.porque, turnos, checks: checksCaso });
}

setBienvenida(saludoOriginal);
setOverrides(overridesOriginales);

salida.costo_usd = Number(llevo().toFixed(4));
salida.modelo = process.env.ANTHROPIC_MODEL || process.env.OPENROUTER_MODEL || "claude-haiku-4-5";
fs.mkdirSync(path.resolve(process.cwd(), "scripts/salida"), { recursive: true });
fs.writeFileSync(
  path.resolve(process.cwd(), "scripts/salida/conversaciones-reales.json"),
  JSON.stringify(salida, null, 1),
  { encoding: "utf-8" }
);

console.log(`\n💵 US$${llevo().toFixed(4)} de US$${TOPE_USD}`);
console.log(totalFail === 0 ? `🎉 ${totalOk} revisiones OK, 0 falladas\n` : `💥 ${totalOk} OK, ${totalFail} falladas\n`);
console.log("→ scripts/salida/conversaciones-reales.json");
