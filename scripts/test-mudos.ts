import "./env-loader.js";
import {
  getOrCreateConversation,
  getConversationById,
  setCategoria,
  setCtwaReferral,
  setModeAutomatico,
  registrarMudo,
  listMudos,
  deleteConversation,
} from "../src/lib/db.js";
import { silenciar } from "../src/lib/tools/silenciar.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST el lead de un anuncio nunca se queda mudo\n");

// ── El candado de silenciar() ────────────────────────────────────────────────
console.log("— a quién se puede callar —");

const leadPhone = "56900000TESTMUDO1";
const lead = getOrCreateConversation(leadPhone, "Lead de anuncio");
setCategoria(lead.id, "potencial", false);
setCtwaReferral(lead.id, { source: "ctwa_ad", title: "Clases de arte en Valdivia" });
setModeAutomatico(lead.id, "AI");

const r1 = await silenciar({ conversationId: lead.id });
check("a un lead de anuncio NO se le puede callar", r1.ok === false, JSON.stringify(r1));
check("y el motivo dice por qué", r1.motivo === "lead_de_anuncio", String(r1.motivo));
check("el bot sigue encendido con él", getConversationById(lead.id)?.mode === "AI", String(getConversationById(lead.id)?.mode));

const amigaPhone = "56900000TESTMUDO2";
const amiga = getOrCreateConversation(amigaPhone, "Amiga de Mary");
setCategoria(amiga.id, "mary", false);
setModeAutomatico(amiga.id, "AI");

const r2 = await silenciar({ conversationId: amiga.id });
check("a la vida personal de Mary sí se le calla", r2.ok === true, JSON.stringify(r2));
check("y el bot queda apagado en ese chat", getConversationById(amiga.id)?.mode === "HUMAN", String(getConversationById(amiga.id)?.mode));

// ── El motivo queda anotado ──────────────────────────────────────────────────
console.log("\n— por qué se quedó sin respuesta —");

registrarMudo(lead.id, "sin_texto_del_modelo");
const anotados = listMudos(20).filter(m => m.conversation_id === lead.id);
check("queda anotado en la base", anotados.length === 1, String(anotados.length));
check("con el motivo", anotados[0]?.motivo === "sin_texto_del_modelo", String(anotados[0]?.motivo));
check("y con la categoría, para saber si era plata pagada", anotados[0]?.categoria === "potencial", String(anotados[0]?.categoria));

registrarMudo(amiga.id, "silencio_deliberado");
check("el silencio a propósito también se distingue", listMudos(20).some(m => m.conversation_id === amiga.id && m.motivo === "silencio_deliberado"));

// Anotar nunca puede tumbar al bot.
registrarMudo(999999999, "conversacion_que_no_existe");
check("anotar un id inexistente no revienta", true);

// Limpieza.
deleteConversation(lead.id);
deleteConversation(amiga.id);
check("limpieza: conversaciones de prueba borradas", getConversationById(lead.id) === null && getConversationById(amiga.id) === null);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
