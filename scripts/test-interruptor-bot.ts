import "./env-loader.js";
import {
  getOrCreateConversation,
  getConversationById,
  setMode,
  setModeAutomatico,
  deleteConversation,
  setCategoria,
} from "../src/lib/db.js";
import { puedeDecidirElSistema } from "../src/lib/quien-contesta.js";
import { siguienteModo, textoInterruptor } from "../src/lib/interruptor-bot.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST interruptor del bot dentro del chat (19-08-2026)\n");

// ── Lo que hace el botón según cómo esté el bot ───────────────────────────────
check("con el bot encendido, el botón lo apaga", siguienteModo(true) === "HUMAN");
check("con el bot apagado, el botón lo enciende", siguienteModo(false) === "AI");

const on = textoInterruptor(true);
const off = textoInterruptor(false);
check("encendido: dice que está contestando el bot", on.estado === "El bot está contestando");
check("encendido: el botón ofrece apagarlo", on.accion === "Apagar bot");
check("apagado: dice que contesta Mary", off.estado === "El bot está apagado");
check("apagado: el botón ofrece encenderlo", off.accion === "Encender bot");
check("los dos textos son distintos (no se confunde el estado con la acción)", on.estado !== on.accion && off.estado !== off.accion);

// ── Lo que pasa de verdad en la base ─────────────────────────────────────────
const phone = "56900000TESTINTERRUPTOR";
const conv = getOrCreateConversation(phone, "Lead Prueba Interruptor");
setCategoria(conv.id, "potencial"); // lead de Meta: el sistema quiere tenerlo encendido

setMode(conv.id, "HUMAN"); // Mary aprieta "Apagar bot"
let fila = getConversationById(conv.id)!;
check("apagar desde el panel deja mode = HUMAN", fila.mode === "HUMAN", String(fila.mode));
check("queda marcado como decisión de una persona", fila.mode_manual === 1, String(fila.mode_manual));
check("el sistema ya no puede decidir en ese chat", !puedeDecidirElSistema(fila));

// El caso que importa: el lead vuelve a escribir y el automático querría encenderlo.
setModeAutomatico(conv.id, "AI");
fila = getConversationById(conv.id)!;
check("el automático NO revive el bot que Mary apagó", fila.mode === "HUMAN", String(fila.mode));

setMode(conv.id, "AI"); // Mary lo vuelve a encender a mano
fila = getConversationById(conv.id)!;
check("encender desde el panel deja mode = AI", fila.mode === "AI", String(fila.mode));
check("sigue marcado como decisión de una persona", fila.mode_manual === 1, String(fila.mode_manual));

// Y al revés: el automático tampoco puede callar lo que Mary encendió.
setModeAutomatico(conv.id, "HUMAN");
fila = getConversationById(conv.id)!;
check("el automático NO apaga el bot que Mary encendió", fila.mode === "AI", String(fila.mode));

// Apoderado: Mary puede encenderle el bot a mano aunque el sistema lo tenga mudo.
setCategoria(conv.id, "arteluk");
setMode(conv.id, "AI");
setModeAutomatico(conv.id, "HUMAN");
fila = getConversationById(conv.id)!;
check("en un apoderado, la decisión de Mary también manda", fila.mode === "AI", String(fila.mode));

deleteConversation(conv.id);
check("limpieza: conversación de prueba borrada", getConversationById(conv.id) === null);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
