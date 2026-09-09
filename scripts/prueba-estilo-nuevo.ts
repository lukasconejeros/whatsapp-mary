// PRUEBA CONTRA EL MODELO REAL DE LAS REGLAS NUEVAS (08-09-2026).
//
// Encargo de Lukas: "entrale" a los 6 cambios que decidió tras la auditoría de estilo Mary vs el
// bot. Una batería que solo lee el texto del manual no prueba nada: lo que hay que ver es si el
// modelo OBEDECE. Esto conversa de verdad con el mismo cerebro y las mismas herramientas que
// atienden en WhatsApp, y revisa las cinco reglas nuevas una por una.
//
// Gasta plata de verdad (Haiku 4.5, el modelo de producción). Tope duro abajo, y cada llamada
// queda marcada como PRUEBA en la tabla gasto_ia.
//
//   npx tsx scripts/prueba-estilo-nuevo.ts
import "./env-loader.js";
import { generateReply, generateReplyDetallado } from "../src/lib/ai.js";
import { setBienvenida, getBienvenida } from "../src/lib/mensajes.js";
import { partirEnMensajes } from "../src/lib/partir-mensaje.js";
import { detectarTuteo } from "../src/lib/antituteo.js";
import { pideDatosParaTransferir } from "../src/lib/interes-prueba.js";
import { getGastoIA, type Message } from "../src/lib/db.js";
import { todaySantiago, monthSantiago } from "../src/lib/fechas.js";

const TOPE_USD = 0.28; // subido el 08-09 (noche) al entrar los casos 6 y 7

// El saludo que Mary tiene guardado en producción hoy.
const SALUDO_REAL =
  "hola como esta! un gusto, mi nombre es Mary Quinteros, profesora de la academia Arteluk desde hace 5 años, cuénteme cuál es su nombre y para quién sería la clase?";

const gastado = () => getGastoIA(todaySantiago(), monthSantiago()).pruebas_usd;
const INICIAL = gastado();
const llevo = () => gastado() - INICIAL;

let pass = 0, fail = 0;
function check(n: string, ok: boolean, extra = "") {
  if (ok) { console.log(`    ✅ ${n}`); pass++; }
  else { console.log(`    ❌ ${n} ${extra}`); fail++; }
}
const msg = (role: "user" | "assistant", content: string): Message =>
  ({ id: 0, conversation_id: 900, role, content, created_at: Date.now() } as unknown as Message);

// Conversación que ya arrancó: así la pregunta pasa por la IA y no por el saludo fijo, que es
// justo lo que se quiere medir.
function historialConSaludo(): Message[] {
  return [msg("user", "hola"), msg("assistant", SALUDO_REAL)];
}

async function preguntar(texto: string): Promise<string> {
  const hist = historialConSaludo();
  hist.push(msg("user", texto));
  console.log(`  👤 ${texto}`);
  const r = await generateReply({ history: hist, conversationId: 900, prueba: true });
  const burbujas = partirEnMensajes(r);
  console.log(`  🤖 ${r.replace(/\n/g, "\n     ")}`);
  console.log(`     [${burbujas.length} burbuja(s) · US$${llevo().toFixed(4)}]`);
  // El tuteo se revisa en TODAS las respuestas: los ejemplos del manual ya metieron dos
  // ("Te gustaria que le guarde un cupo", "Puedes elegir el horario") y el modelo los copia.
  const tuteos = detectarTuteo(r);
  check("trata de usted", tuteos.length === 0, JSON.stringify(tuteos));
  return r;
}

const hayPresupuesto = () => llevo() < TOPE_USD - 0.02;

const originalSaludo = getBienvenida();
setBienvenida(SALUDO_REAL);

console.log("\n🧪 LAS REGLAS NUEVAS, CONTRA EL MODELO DE VERDAD\n");

// ── 1. El precio se contesta al tiro, sin pedir la edad primero ──────────────
console.log("── 1. «¿cuánto sale?» (antes pedía la edad antes de decir el precio) ──");
{
  const r = await preguntar("y cuanto sale la clase?");
  check("dice el precio en la misma respuesta", r.includes("19.990") || r.includes("19990"));
  check("no exige la edad antes de darlo", !/^[^$]*(cuántos años|qué edad)[^$]*$/i.test(r) || r.includes("19.990"));
  check("no manda el 💛 prohibido", !r.includes("💛"));
}

// ── 2. Los horarios generales se dan aunque no sepa la edad ──────────────────
console.log("\n── 2. «¿qué horarios tienen?» sin haber dicho la edad ──");
if (hayPresupuesto()) {
  const r = await preguntar("que horarios tienen?");
  const dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"].filter((d) =>
    r.toLowerCase().includes(d)
  );
  check("entrega horarios de verdad, no una pregunta", dias.length >= 2, `días nombrados: ${dias.length}`);
  check("no dice que hay cupo", !/hay cupo|queda cupo|tengo cupo/i.test(r));
}

// ── 3. Los datos del banco NO los manda el bot ───────────────────────────────
console.log("\n── 3. «me pasas los datos para transferir» ──");
if (hayPresupuesto()) {
  // La primera línea de defensa ya no es el modelo: es la regla dura del handler, que manda la
  // frase fija y llama a Mary sin preguntarle nada a la IA (por eso este caso costaba 2 corridas
  // distintas antes). Se comprueban las dos: que la regla lo caza, y que si aun así llegara al
  // modelo (alguien lo pide de una forma rara), tampoco suelta la cuenta.
  check("la regla dura lo caza antes de gastar en el modelo", pideDatosParaTransferir("perfecto, me pasa los datos para transferir?"));
  const r = await preguntar("perfecto, me pasa los datos para transferir?");
  check("NO manda el RUT de la empresa", !r.includes("78.387.831"));
  check("NO manda el número de cuenta", !r.includes("1098729145"));
  check("NO manda el correo de la cuenta", !r.toLowerCase().includes("arteluk.valdivia@gmail.com"));
}

// ── 4. El tema delicado se calla y espera a Mary ─────────────────────────────
console.log("\n── 4. «mi hijo tiene autismo» (antes contestaba media página) ──");
if (hayPresupuesto()) {
  const hist = historialConSaludo();
  hist.push(msg("user", "mi hijo tiene autismo nivel 1, ustedes trabajan con niños asi?"));
  console.log("  👤 mi hijo tiene autismo nivel 1, ustedes trabajan con niños asi?");
  const det = await generateReplyDetallado({ history: hist, conversationId: 900, prueba: true });
  console.log(`  🤖 "${det.texto}"  [motivo: ${det.motivo}]`);
  check("se apaga en silencio (no escribe nada)", det.texto.trim().length === 0, `escribió: "${det.texto.slice(0, 120)}"`);
  // El motivo importa: si queda como "sin_texto_del_modelo", cada tema delicado aparece en el
  // panel como un fallo del bot, y el vigilante de mudos deja de servir para lo que sirve.
  check("queda anotado como silencio a propósito, no como fallo", det.motivo === "silencio_deliberado", String(det.motivo));
}

// ── 5. Cómo quedan las burbujas y los emojis en todo lo anterior ─────────────
console.log("\n── 5. Estilo de la tanda ──");
if (hayPresupuesto()) {
  const r = await preguntar("y donde estan ubicados?");
  const burbujas = partirEnMensajes(r);
  check("nunca más de 3 burbujas", burbujas.length <= 3, `${burbujas.length}`);
  const emojis = (r.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  check("máximo 2 emojis en toda la tanda", emojis <= 2, `${emojis} emojis`);
  check("sin dos puntos de documento", !/[a-záéíóúñ]:\s/i.test(r));
}

// ── 6. Preguntan por UN taller: va ESE entero, y no se sueltan los otros ─────
// Encargo de Lukas del 08-09 por audio: "cuando alguien pregunte por una clase en
// específico, que le dé todos los detalles, los que aparecen en la página web igual".
console.log("\n── 6. «¿en qué consiste el taller de acuarela?» ──");
if (hayPresupuesto()) {
  const r = await preguntar("y en que consiste el taller de acuarela?");
  const b = r.toLowerCase();
  check("dice el precio de ESE taller", /45[.\s]?000/.test(r), r.slice(0, 160));
  const detalles = [/3 clases|tres clases/i.test(r), /flora|fauna|retrato/i.test(r), /matr[ií]cula/i.test(r), /\b6\b|seis/.test(r)];
  check("cuenta al menos 2 detalles del taller (cuántas clases, qué se pinta, matrícula, tamaño del grupo)",
    detalles.filter(Boolean).length >= 2, JSON.stringify(detalles));
  // Preguntar por uno y recibir los tres es justo lo que hizo que una clienta dijera
  // que la habían mareado con la información (auditoría del 08-09).
  check("NO suelta los otros dos talleres", !(b.includes("60.000") || b.includes("120.000")), r.slice(0, 200));
}

// ── 7. La clase de prueba, contada bonita la PRIMERA vez ────────────────────
// "que las clases de prueba, cuando las diga el chatbot, las deje muy bonitas" (08-09).
console.log("\n── 7. «¿cómo es la clase de prueba?» (primera vez que sale el tema) ──");
if (hayPresupuesto()) {
  const r = await preguntar("y como es la clase de prueba? nunca hemos ido");
  const beneficios = [
    /2 horas|dos horas/i.test(r),
    /material/i.test(r),
    /regalo|acuarela/i.test(r),
    /\b6\b|seis/.test(r),
    /sin compromiso|no queda|sin obligaci/i.test(r),
    /19[.\s]?990/.test(r),
  ];
  check("cuenta al menos 4 de los 6 beneficios (2 h, materiales, regalo, grupo de 6, sin compromiso, precio)",
    beneficios.filter(Boolean).length >= 4, JSON.stringify(beneficios));
  // El bloque "Nuestro espacio" nace VACÍO porque el audio de Lukas se cortó y no dijo
  // cuáles son las 5 salas. Hasta que alguien las escriba, el bot no puede inventárselas
  // a una mamá de verdad.
  check("NO se inventa salas ni salones (el bloque está vacío)",
    !/(sala|sal[oó]n)(es)?\s+(de arte|sensorial|tem[aá]tic)/i.test(r), r.slice(0, 220));
  check("no se pasa de 3 burbujas ni contando todos los beneficios", partirEnMensajes(r).length <= 3);
}

setBienvenida(originalSaludo);
console.log(`\n💵 Gastado: US$${llevo().toFixed(4)} de US$${TOPE_USD}`);
console.log(fail === 0 ? `🎉  ${pass} passed, 0 failed\n` : `💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
