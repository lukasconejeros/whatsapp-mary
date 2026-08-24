/**
 * CUÁNDO EL BOT SE APARTA Y LLAMA A MARY.
 *
 * Encargo de Lukas (19-08-2026): *"cuando las personas ya digan que quieren la clase de prueba
 * —lo pueden decir de distintas formas— … le tiene que decir dame unos minutos para ver
 * disponibilidad y que se apague el chatbot"*.
 *
 * La línea fina, y es la que decide si Mary termina atendiendo todo o solo lo que vale la pena:
 * PREGUNTAR por la clase de prueba no es quererla. "¿tienen clase de prueba?" lo contesta el
 * bot; "quiero la clase de prueba" lo atiende Mary.
 *
 * Por qué una regla dura y no dejárselo al modelo: cuando la frase la escribe el modelo, a veces
 * dice "le aviso a Mary" sin apagarse (Anpalex y Medifis lo tienen anotado como error), y la
 * persona queda esperando a alguien que nunca llega. Acá el texto sale del sistema.
 *
 *   npx tsx scripts/test-interes-prueba.ts
 */
import "./env-loader.js";
import { quiereLaClaseDePrueba, yaSeHabloDeLaClaseDePrueba, FRASE_ESPERA, apartarParaMary } from "../src/lib/interes-prueba";
import { detectarTuteo } from "../src/lib/antituteo.js";
import {
  getOrCreateConversation,
  getConversationById,
  setCategoria,
  setModeAutomatico,
  getRecentHistory,
  deleteConversation,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); pass++; }
  else { console.log(`  ❌ ${msg}`); fail++; }
}

console.log("\n🧪 Cuándo el bot se aparta y llama a Mary\n");

console.log("— dijo que la quiere (de las muchas formas en que se dice) —");
const si = (t: string) => quiereLaClaseDePrueba(t);
ok(si("quiero la clase de prueba"), "quiero la clase de prueba");
ok(si("me interesa la clase de prueba para mi hija"), "me interesa la clase de prueba");
ok(si("Quiero inscribir a mi hija de 7 años"), "quiero inscribir a mi hija");
ok(si("cuando puede ir mi hija a la clase de prueba?"), "cuando puede ir mi hija");
ok(si("como la agendo?"), "como la agendo");
ok(si("dale, hagamos la prueba entonces"), "dale, hagamos la prueba");
ok(si("si, quiero agendar la clase de prueba"), "si, quiero agendar");
ok(si("quisiera reservar un cupo para el sabado"), "quisiera reservar un cupo");
ok(si("ya, me gustaria llevarla el sabado"), "me gustaria llevarla (audio transcrito)");
ok(si("perfecto, la inscribo entonces"), "la inscribo entonces");

console.log("\n— solo está preguntando: eso lo contesta el bot —");
const no = (t: string) => !quiereLaClaseDePrueba(t);
ok(no("hola quiero mas info"), "hola quiero mas info (es el que ABRE la conversación)");
ok(no("tienen clase de prueba?"), "tienen clase de prueba?");
ok(no("en que consiste la clase de prueba?"), "en que consiste la clase de prueba?");
ok(no("cuanto vale la clase de prueba?"), "cuanto vale la clase de prueba?");
ok(no("quiero saber los precios"), "quiero saber los precios");
ok(no("quisiera consultar por los horarios"), "quisiera consultar por los horarios");
ok(no("hola"), "hola pelado");
ok(no("gracias!!"), "gracias");
ok(no(""), "un mensaje vacío no dispara nada");

console.log("\n— el interés GENÉRICO del primer mensaje NO apaga el bot (24-08-2026) —");
// Pasó de verdad: conv 364 hoy 12:26. "Me interesa conocer más sobre la academia para mi hija de
// 8 años" llevaba un "me interesa" y el bot se apartó y le pasó el chat a Mary — esa señora solo
// pedía información. Y el otro botón de Meta ("Me gustaría conseguir más información sobre esto")
// hacía lo mismo en el PRIMER mensaje (conv 358, 21-08 15:19).
const sinContexto = (t: string) => !quiereLaClaseDePrueba(t, false);
ok(sinContexto("Me interesa conocer más sobre la academia para mi hija de 8 años"), "conv 364: me interesa conocer más sobre la academia");
ok(sinContexto("¡Hola! Me gustaría conseguir más información sobre esto."), "conv 358: el botón de Meta con «me gustaría»");
ok(sinContexto("me interesa"), "«me interesa» a secas, sin que nadie haya nombrado la prueba");
ok(sinContexto("hola, me interesa para mi hijo de 6"), "me interesa para mi hijo de 6");

console.log("\n— pero si YA se estaba hablando de la clase de prueba, sí la quiere —");
const conContexto = (t: string) => quiereLaClaseDePrueba(t, true);
ok(conContexto("me interesa"), "el bot le explicó la prueba y contesta «me interesa»");
ok(conContexto("ya, me interesa para mi hija"), "«me interesa para mi hija» después de explicársela");
ok(conContexto("cuando puede ser?"), "«cuándo puede ser?» después de explicársela");
ok(!quiereLaClaseDePrueba("quiero saber los precios", true), "«quiero saber los precios» sigue siendo pregunta");

console.log("\n— nombrar la prueba o pedir hora apaga el bot aunque sea el primer mensaje —");
ok(quiereLaClaseDePrueba("quiero la clase de prueba", false), "«quiero la clase de prueba» de entrada");
ok(quiereLaClaseDePrueba("me gustaria inscribirla", false), "«me gustaría inscribirla» de entrada");
ok(quiereLaClaseDePrueba("como la agendo?", false), "«cómo la agendo?» de entrada");

console.log("\n— ¿se habló ya de la clase de prueba en este chat? —");
const h = (role: string, content: string) => ({ role, content }) as never;
ok(!yaSeHabloDeLaClaseDePrueba([]), "chat vacío → no");
ok(
  !yaSeHabloDeLaClaseDePrueba([h("user", "hola, me interesa")]),
  "solo mensajes de la persona → no (lo que ella diga no cuenta)"
);
ok(
  yaSeHabloDeLaClaseDePrueba([h("user", "hola"), h("assistant", "Antes de ingresar hacemos una clase de prueba de $19.990 😊")]),
  "el bot ya se la explicó → sí"
);
ok(
  yaSeHabloDeLaClaseDePrueba([h("human", "la clase de prueba es el sábado")]),
  "Mary ya la nombró a mano → sí"
);
ok(
  !yaSeHabloDeLaClaseDePrueba([h("assistant", "Estamos en Picarte 804 😊")]),
  "el bot habló de otra cosa → no"
);

console.log("\n— la frase que se manda —");
ok(FRASE_ESPERA === "Deme unos minutos y le confirmo disponibilidad", `es la que eligió Lukas, de usted: "${FRASE_ESPERA}"`);
ok(detectarTuteo(FRASE_ESPERA).length === 0, "y no tutea (regla antituteo del 24-08-2026)");
ok(!/:/.test(FRASE_ESPERA), "sin dos puntos, como el resto de los mensajes de la casa");

// ── Contra la base de verdad: la frase sale, el bot se apaga y Mary se entera ──
console.log("\n— apartarse de verdad (contra SQLite) —");
const conv = getOrCreateConversation("56900000TESTPRUEBA", "Apoderada Prueba Interes");
setCategoria(conv.id, "potencial", false);
setModeAutomatico(conv.id, "AI");
ok(getConversationById(conv.id)?.mode === "AI", "arranca con el bot encendido, como un lead de Meta");

let avisada = 0;
apartarParaMary({
  conversationId: conv.id,
  phone: conv.phone,
  texto: "quiero la clase de prueba para mi hija",
  avisar: () => { avisada++; },
});

const conv2 = getConversationById(conv.id);
const ultimo = getRecentHistory(conv.id, 5).filter((m) => m.role === "assistant").pop();
ok(ultimo?.content === FRASE_ESPERA, `le manda la frase tal cual ("${ultimo?.content ?? "nada"}")`);
ok(conv2?.mode === "HUMAN", "y el bot queda apagado en ese chat");
ok(conv2?.mode_manual === 1, "apagado como decisión firme: el automático no lo vuelve a encender");
ok(avisada === 1, "a Mary le llega UN aviso, no varios");

deleteConversation(conv.id);
ok(getConversationById(conv.id) === null, "limpieza: conversación de prueba borrada");

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
