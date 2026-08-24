// PRUEBA CONVERSACIONAL CONTRA EL MODELO DE VERDAD (24-08-2026).
//
// Encargo de Lukas: "hazle varias pruebas para asegurarte de que funcione, intenta encontrar los
// bugs conversacionales, máximo puedes gastar 1/6 de dólar".
//
// Qué hace: conversaciones completas contra `generateReply` — el mismo camino que sigue un mensaje
// real de WhatsApp, con el cerebro real y las herramientas reales — con el saludo que Mary tiene
// guardado HOY en producción. Cada respuesta se revisa sola (tuteo, saludo de la hora, saludo
// repetido, promesas sin llamar a Mary) y además se guarda la transcripción entera para leerla.
//
// El gasto se mide de verdad: cada llamada queda en la tabla `gasto_ia` marcada como PRUEBA, y
// antes de cada turno se comprueba el tope. Si el siguiente turno pudiera pasarse, se corta.
//
//   npx tsx scripts/prueba-conversacional.ts
import "./env-loader.js";
import { writeFileSync } from "node:fs";
import { generateReply } from "../src/lib/ai.js";
import { setBienvenida, getBienvenida, saludoPorHora } from "../src/lib/mensajes.js";
import { detectarTuteo } from "../src/lib/antituteo.js";
import { getGastoIA, type Message } from "../src/lib/db.js";
import { todaySantiago, monthSantiago, hourSantiago } from "../src/lib/fechas.js";

const TOPE_USD = 0.15; // 1/6 de dólar es 0,1666: se deja margen para no pasarse
const SALIDA = process.env.SALIDA_PRUEBA ?? "prueba-conversacional.txt";

// El saludo REAL que Mary tiene guardado en producción (GET /api/config, 24-08 13:55).
const SALUDO_REAL =
  "hola como esta! un gusto, mi nombre es Mary Quinteros, profesora de la academia Arteluk desde hace 5 años, cuénteme cuál es su nombre y para quién sería la clase?";

const gastado = () => getGastoIA(todaySantiago(), monthSantiago()).pruebas_usd;
const INICIAL = gastado();
const llevo = () => gastado() - INICIAL;

let pass = 0, fail = 0;
const fallos: string[] = [];
const transcripcion: string[] = [];
function di(s = "") { console.log(s); transcripcion.push(s); }
function check(n: string, ok: boolean, extra = "") {
  if (ok) { di(`    ✅ ${n}`); pass++; }
  else { di(`    ❌ ${n} ${extra}`); fail++; fallos.push(`${n} ${extra}`.trim()); }
}

let seq = 0;
function msg(role: Message["role"], content: string, media: string | null = null): Message {
  return { id: ++seq, conversation_id: 900, role, content, created_at: Date.now(), media };
}

// ── Lo que se le revisa a CADA respuesta que sale hacia la apoderada ──────────
function revisarRespuesta(etiqueta: string, texto: string) {
  const tuteos = detectarTuteo(texto);
  check(`${etiqueta}: trata de usted`, tuteos.length === 0, JSON.stringify(tuteos));
  check(
    `${etiqueta}: no dice «cómo estás/estai»`,
    !/c[oó]mo\s+(est[aá]s|estai)/i.test(texto),
    texto.slice(0, 60)
  );
  const saludos = (texto.match(/\b(hola|buenos d[ií]as|buenas tardes|buenas noches)\b/gi) ?? []).length;
  check(`${etiqueta}: no saluda dos veces`, saludos <= 1, `(${saludos} saludos)`);
}

function esperaDeLaHora(): string {
  return saludoPorHora(hourSantiago());
}

async function turno(hist: Message[], texto: string, etiqueta: string): Promise<string> {
  hist.push(msg("user", texto));
  di(`  👤 ${texto}`);
  const r = await generateReply({ history: hist, conversationId: 900, prueba: true });
  hist.push(msg("assistant", r));
  di(`  🤖 ${r.replace(/\n/g, "\n     ")}`);
  di(`     [gastado hasta aquí: US$${llevo().toFixed(4)}]`);
  revisarRespuesta(etiqueta, r);
  return r;
}

function hayPresupuesto(): boolean {
  // Un turno de estos ronda los US$0,01: se corta con margen suficiente.
  if (llevo() < TOPE_USD - 0.015) return true;
  di(`\n🛑 CORTADO POR PRESUPUESTO: llevo US$${llevo().toFixed(4)} del tope US$${TOPE_USD}`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
const originalSaludo = getBienvenida();
setBienvenida(SALUDO_REAL);

di(`\n🧪 PRUEBA CONVERSACIONAL CONTRA EL MODELO REAL`);
di(`   Saludo guardado: «${SALUDO_REAL}»`);
di(`   Hora de Chile: ${hourSantiago()}:00 ⇒ debe abrir con «${esperaDeLaHora()}»`);
di(`   Tope: US$${TOPE_USD}\n`);

// ── 1. El lead del anuncio de Meta, sin preguntar nada (NO llama a la IA) ─────
di("── 1. Lead de Meta, solo toca el botón ──");
{
  const hist: Message[] = [];
  const r = await turno(hist, "¡Hola! Quiero más información", "1");
  check("1: abre con el saludo de la hora", r.startsWith(esperaDeLaHora()), r.slice(0, 40));
  check("1: mantiene las palabras de Mary", r.includes("profesora de la academia Arteluk desde hace 5 años"));
  check("1: no le costó plata (sin IA)", llevo() === 0, `US$${llevo().toFixed(4)}`);
}

// ── 2. El otro botón de Meta, el que apagaba el bot ──────────────────────────
di("\n── 2. El otro botón de Meta («me gustaría conseguir más información») ──");
{
  const hist: Message[] = [];
  const r = await turno(hist, "¡Hola! Me gustaría conseguir más información sobre esto.", "2");
  check("2: abre con el saludo de la hora", r.startsWith(esperaDeLaHora()), r.slice(0, 40));
  check("2: el bot NO se apagó (contestó algo)", r.trim().length > 0);
}

// ── 3. Saludo + pregunta en el mismo primer contacto (sí llama a la IA) ──────
di("\n── 3. Saluda y pregunta a la vez (conv 365 real) ──");
if (hayPresupuesto()) {
  const hist: Message[] = [];
  const r = await turno(hist, "¡Hola! Quiero más información\nDonde estan ubiscados", "3");
  check("3: abre con el saludo de la hora", r.startsWith(esperaDeLaHora()), r.slice(0, 40));
  check("3: responde además la pregunta", r.length > SALUDO_REAL.length + 20);
}

// ── 4. La mamá completa: de "hola" a querer la clase de prueba ───────────────
di("\n── 4. Conversación completa de una mamá interesada ──");
{
  const hist: Message[] = [];
  await turno(hist, "hola", "4a");
  const guion = [
    "es para mi hija, tiene 8 años",
    "y cuánto sale la clase?",
    "ya, me interesa. qué días tienen?",
    "perfecto, quiero inscribirla",
  ];
  for (const t of guion) {
    if (!hayPresupuesto()) break;
    await turno(hist, t, "4");
  }
}

// ── 5. Alguien que tutea al bot: el bot NO se contagia ──────────────────────
di("\n── 5. La apoderada tutea al bot ──");
if (hayPresupuesto()) {
  const hist: Message[] = [];
  await turno(hist, "hola, oye tenís cupo para mi hijo? tú haces las clases?", "5");
}

// ── 6. Saludar de nuevo a mitad de conversación ─────────────────────────────
di("\n── 6. Vuelve a saludar a mitad de conversación ──");
if (hayPresupuesto()) {
  const hist: Message[] = [
    msg("user", "hola"),
    msg("assistant", "Buenas tardes, un gusto, mi nombre es Mary Quinteros."),
    msg("user", "gracias"),
    msg("assistant", "A usted."),
  ];
  const r = await turno(hist, "hola de nuevo, se me olvidó preguntar el horario", "6");
  check("6: NO repite el saludo largo de Mary", !r.includes("profesora de la academia Arteluk desde hace 5 años"));
}

// ── 7. Mary contestó a mano: el bot no la pisa ──────────────────────────────
di("\n── 7. Mary ya contestó a mano ──");
{
  const hist: Message[] = [msg("user", "hola"), msg("human", "hola! cuénteme para quién es")];
  hist.push(msg("user", "para mi hija de 6"));
  di(`  👤 para mi hija de 6  (Mary ya había contestado)`);
  const antes = llevo();
  if (hayPresupuesto()) {
    const r = await generateReply({ history: hist, conversationId: 900, prueba: true });
    di(`  🤖 ${r.replace(/\n/g, "\n     ")}`);
    check("7: no repite el saludo fijo encima de Mary", !r.startsWith(esperaDeLaHora() + ", un gusto"));
    revisarRespuesta("7", r);
  } else { di(`  (saltado, sin presupuesto; llevaba US$${antes.toFixed(4)})`); }
}

setBienvenida(originalSaludo);

di(`\n${"─".repeat(70)}`);
di(`GASTADO: US$${llevo().toFixed(4)} de US$${TOPE_USD} (tope pedido: 1/6 = US$0,1667)`);
di(`${fail === 0 ? "✅" : "❌"} ${pass} ok, ${fail} fallando`);
if (fallos.length) { di("\nLo que falló:"); fallos.forEach((f) => di(`  · ${f}`)); }
writeFileSync(SALIDA, transcripcion.join("\n"), "utf8");
console.log(`\n📄 Transcripción completa en ${SALIDA}`);
process.exit(fail === 0 ? 0 : 1);
