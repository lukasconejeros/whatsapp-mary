/**
 * PEDIR LOS DATOS PARA TRANSFERIR = LO ATIENDE MARY (08-09-2026).
 *
 * Decisión de Lukas: la cuenta la manda ella, no el bot. Primero se puso solo en el manual y la
 * prueba contra el modelo real lo desmintió dos veces seguidas: en una corrida contestó bien
 * ("deme unos minutos y le confirmo") y en la siguiente se quedó MUDO. Con el mismo mensaje. Es
 * la lección que ya está anotada en este repo: **lo que no puede fallar no se le pide al modelo,
 * se escribe en el código.**
 *
 * Así que este caso se trata igual que "quiero la clase de prueba": frase fija del sistema, bot
 * apagado y aviso a Mary, todo antes de gastar un peso en el modelo.
 *
 *   npx tsx scripts/test-datos-transferencia.ts
 */
import "./env-loader.js";
import { pideDatosParaTransferir, FRASE_DATOS, apartarPorDatos } from "../src/lib/interes-prueba";
import {
  getOrCreateConversation,
  getConversationById,
  setModeAutomatico,
  getRecentHistory,
  deleteConversation,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ ${msg}`); pass++; }
  else { console.log(`  ❌ ${msg}`); fail++; }
}

console.log("\n🧪 Los datos para transferir los manda Mary\n");

console.log("— las formas reales de pedirlos —");
const si = (t: string) => pideDatosParaTransferir(t);
ok(si("me pasa los datos para transferir?"), "me pasa los datos para transferir");
ok(si("perfecto, me pasas los datos bancarios"), "los datos bancarios");
ok(si("a que cuenta le deposito?"), "a qué cuenta le deposito");
ok(si("como le pago la clase de prueba?"), "cómo le pago");
ok(si("me manda el numero de cuenta porfa"), "el número de cuenta");
ok(si("donde transfiero?"), "dónde transfiero");
ok(si("Me puede enviar los datos de la transferencia"), "los datos de la transferencia");

console.log("\n— lo que NO es pedir la cuenta (esto lo sigue contestando el bot) —");
const no = (t: string) => !pideDatosParaTransferir(t);
ok(no("cuanto sale la clase de prueba?"), "cuánto sale");
ok(no("se paga mensual o por clase?"), "se paga mensual o por clase");
ok(no("hola, quiero informacion"), "quiero información");
ok(no("cuales son los datos del taller?"), "los datos del taller");
ok(no("que dias tienen clases?"), "qué días tienen clases");
ok(no("mi hija se llama Emilia y yo soy Carolina"), "los nombres de la mamá y la hija");

console.log("\n— y el bot se aparta con la frase fija —");
const conv = getOrCreateConversation("56990007777", "Prueba Datos");
setModeAutomatico(conv.id, "AI");
let avisada = 0;
apartarPorDatos({
  conversationId: conv.id,
  phone: conv.phone,
  texto: "me pasa los datos para transferir?",
  nombre: "Prueba Datos",
  avisar: () => { avisada++; },
});
const ultimo = getRecentHistory(conv.id, 5).filter((m) => m.role === "assistant").pop();
ok(ultimo?.content === FRASE_DATOS, `le manda la frase fija ("${ultimo?.content ?? "nada"}")`);
ok(!/\d{5,}/.test(FRASE_DATOS), "la frase NO lleva ningún número de cuenta");
ok(getConversationById(conv.id)?.mode === "HUMAN", "el bot queda apagado en ese chat");
ok(avisada === 1, "a Mary le llega un aviso");

deleteConversation(conv.id);
ok(getConversationById(conv.id) === null, "limpieza: conversación de prueba borrada");

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
