import "./env-loader.js";
import {
  getOrCreateConversation,
  setCerrado,
  getConversationById,
  listConversations,
  deleteConversation,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST lead CERRADO (toggle en DB)\n");

// Contacto de prueba con teléfono único (se borra al final).
const phone = "56900000TESTCERRADO";
const conv = getOrCreateConversation(phone, "Lead Prueba Cerrado");

check("por defecto NO viene cerrado", !getConversationById(conv.id)?.cerrado, String(getConversationById(conv.id)?.cerrado));

setCerrado(conv.id, true);
check("setCerrado(true) → cerrado = 1", getConversationById(conv.id)?.cerrado === 1, String(getConversationById(conv.id)?.cerrado));

// listConversations expone el flag (para el mapeo del inbox).
const enLista = listConversations().find(c => c.id === conv.id);
check("aparece en listConversations con cerrado = 1", enLista?.cerrado === 1, String(enLista?.cerrado));

setCerrado(conv.id, false);
check("setCerrado(false) → cerrado = 0 (reabrir)", getConversationById(conv.id)?.cerrado === 0, String(getConversationById(conv.id)?.cerrado));

// Idempotente: volver a cerrar dos veces no rompe ni acumula.
setCerrado(conv.id, true);
setCerrado(conv.id, true);
check("idempotente al cerrar dos veces", getConversationById(conv.id)?.cerrado === 1, String(getConversationById(conv.id)?.cerrado));

// Limpieza.
deleteConversation(conv.id);
check("limpieza: conversación de prueba borrada", getConversationById(conv.id) === null);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
