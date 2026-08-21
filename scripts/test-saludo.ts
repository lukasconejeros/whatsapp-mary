// TEST del saludo editable de "Entrenar IA".
//
// Lo que cuida: que el texto que Mary escribe en el panel se use SOLO en el primer "hola" pelado
// de alguien nuevo, y que TODO lo demás siga contestándolo la IA como hasta hoy. El riesgo real
// es al revés de lo que parece: un atajo demasiado goloso le contestaría con una plantilla a una
// mamá que ya venía conversando, o encima de un mensaje que Mary respondió a mano.
import "./env-loader.js";
import {
  DEFAULT_BIENVENIDA,
  getBienvenida,
  setBienvenida,
  esSaludoPuro,
  bienvenidaPara,
  validarBienvenida,
} from "../src/lib/mensajes.js";
import { generateReply } from "../src/lib/ai.js";
import { buildSystemPrompt } from "../src/lib/system-prompt.js";
import type { Message } from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

// Un mensaje del historial, con lo mínimo que mira la decisión.
let seq = 0;
function msg(role: Message["role"], content: string, media: string | null = null): Message {
  return { id: ++seq, conversation_id: 1, role, content, created_at: Date.now(), media };
}

console.log("\n🧪 TEST del saludo editable (Entrenar IA)\n");

// ── Qué cuenta como saludo pelado ────────────────────────────────────────────
console.log("— qué es un saludo a secas —");
check("hola", esSaludoPuro("hola"));
check("Hola!", esSaludoPuro("Hola!"));
check("holaaa (vocal estirada)", esSaludoPuro("holaaa"));
check("buenas tardes", esSaludoPuro("buenas tardes"));
check("Buenos días 👋 (con emoji)", esSaludoPuro("Buenos días 👋"));
check("hola + pregunta NO es saludo pelado", !esSaludoPuro("hola, cuánto vale la clase?"));
check("«más información» NO es saludo", !esSaludoPuro("más información"));
check("vacío NO es saludo", !esSaludoPuro("   "));

// ── El texto guardado ────────────────────────────────────────────────────────
console.log("\n— lo que Mary escribe se guarda y manda —");
const original = getBienvenida();
check("de fábrica sale la presentación de Mary", getBienvenida().includes("Mary Quinteros"));
setBienvenida("¡Hola! 😊 Soy Mary de Arteluk, ¿para quién sería la clase?");
check("guarda lo que ella escribe", getBienvenida().startsWith("¡Hola! 😊 Soy Mary de Arteluk"));
check("el texto de fábrica sigue disponible para restaurar", DEFAULT_BIENVENIDA.includes("Mary Quinteros"));

// ── La familia completa: cuándo se dispara y cuándo NO ───────────────────────
console.log("\n— cuándo contesta el texto fijo —");
check(
  "«hola» pelado de alguien nuevo → sale el texto del panel",
  bienvenidaPara([msg("user", "hola")]).startsWith("¡Hola! 😊 Soy Mary de Arteluk")
);
check(
  "«hola, cuánto vale?» → NO, contesta la IA",
  bienvenidaPara([msg("user", "hola, cuánto vale?")]) === ""
);
check(
  "saluda de nuevo a mitad de conversación → NO",
  bienvenidaPara([msg("user", "hola"), msg("assistant", "¡Hola! ¿para quién sería?"), msg("user", "hola")]) === ""
);
check(
  "Mary ya le había contestado a mano → NO (no la pisa)",
  bienvenidaPara([msg("user", "hola"), msg("human", "hola! cuéntame"), msg("user", "hola")]) === ""
);
check(
  "primer contacto con foto → NO (la foto se describe, no se saluda)",
  bienvenidaPara([msg("user", "hola", "IMG-1.jpg")]) === ""
);
check(
  "cuatro mensajes suyos sin respuesta → NO (ya no es el primer contacto)",
  bienvenidaPara([msg("user", "hola"), msg("user", "hola?"), msg("user", "?"), msg("user", "hola")]) === ""
);
check(
  "el último mensaje es del bot → NO",
  bienvenidaPara([msg("user", "hola"), msg("assistant", "¡Hola!")]) === ""
);
check("historial vacío → NO", bienvenidaPara([]) === "");

// ── Lo que el panel no deja guardar ──────────────────────────────────────────
console.log("\n— lo que el panel no deja guardar —");
check("un saludo normal se guarda", validarBienvenida("¡Hola! Soy Mary de Arteluk 😊").ok);
check("vacío se guarda (es la forma de apagarlo)", validarBienvenida("").ok);
check("con {nombre} NO: se enviaría con las llaves puestas", !validarBienvenida("Hola {nombre}, soy Mary").ok);
check("de 400 letras para arriba NO", !validarBienvenida("hola ".repeat(120)).ok);

// ── De punta a punta, con el bot de verdad ───────────────────────────────────
// Si el saludo sale sin pasar por el modelo, esta llamada funciona aunque no haya clave de
// OpenRouter en este PC: es la prueba de que un "hola" pelado dejó de costar plata.
console.log("\n— el bot completo, sin llamar a la IA —");
setBienvenida("¡Hola! 😊 Soy Mary de Arteluk, cuéntame para quién sería la clase.");
const respuesta = await generateReply({ history: [msg("user", "hola")], conversationId: 1 });
check("el bot responde el texto del panel", respuesta.startsWith("¡Hola! 😊 Soy Mary de Arteluk"), respuesta);

console.log("\n— si Mary deja la caja vacía, vuelve a improvisar la IA —");
setBienvenida("");
check("caja vacía → NO hay texto fijo", bienvenidaPara([msg("user", "hola")]) === "");


// ── Lo que reclamó Lukas el 21-08-2026: el saludo del panel tiene que mandar TAMBIÉN cuando
// contesta la IA. El caso real es el botón del anuncio de Meta ("¡Hola! Quiero más información"):
// no es un saludo pelado, así que lo contesta el modelo — y el modelo leía el saludo VIEJO
// escrito a mano dentro de prompts/negocio.md, no el del panel.
console.log("\n— el saludo del panel manda también cuando contesta la IA —");
setBienvenida("Hola, soy Mary Quinteros, profesora de la academia Arteluk desde hace 5 años, ¿para quién sería la clase?");
const cerebro1 = buildSystemPrompt();
check("el cerebro del bot lleva el saludo que Mary escribió", cerebro1.includes("profesora de la academia Arteluk desde hace 5 años"));
check(
  "y ya NO lleva el saludo viejo escrito a mano en el prompt",
  !cerebro1.includes("magíster en psicología, ingeniera y artista, y directora de Academia")
);
// El panel y el bot son procesos distintos: si el caché del cerebro no mira el saludo, Mary
// guardaría y el bot seguiría diciendo lo anterior hasta reiniciar el contenedor.
setBienvenida("Hola, soy Mary y enseño arte en Valdivia, ¿para quién sería la clase?");
check("si ella lo cambia, el cerebro se entera al toque (caché)", buildSystemPrompt().includes("enseño arte en Valdivia"));
setBienvenida("");
check("caja vacía → el cerebro vuelve al saludo de fábrica", buildSystemPrompt().includes("magíster en psicología"));

// Deja la base como estaba (si no había nada guardado, queda el texto de fábrica: es el mismo
// que usaba antes, así que el bot saluda igual).
setBienvenida(original);
check("la base queda como estaba", getBienvenida() === original);
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} ok, ${fail} fallando\n`);
process.exit(fail === 0 ? 0 : 1);
