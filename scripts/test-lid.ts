import "./env-loader.js";
import { getOrCreateConversation, getConversationById, deleteConversation } from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST @lid → número real (sin perder mensajes)\n");

const lidPhone = "199999999999001";      // identificador @lid (número largo)
const realPhone = "56977777001";          // número real de WhatsApp
const nombre = "Contacto Lid Prueba Zqx";

// 1) Primer mensaje llega por @lid (WhatsApp no dio el número) → se crea con el número largo.
const c1 = getOrCreateConversation(lidPhone, nombre, `${lidPhone}@lid`);
check("al inicio se ve con el número @lid (largo)", getConversationById(c1.id)?.phone === lidPhone, getConversationById(c1.id)?.phone);

// 2) Luego llega con el número REAL (senderPn) y mismo nombre → MISMA conversación y el
//    teléfono/jid ascienden al número real (deja de verse el número largo).
const c2 = getOrCreateConversation(realPhone, nombre, `${realPhone}@s.whatsapp.net`);
check("es la MISMA conversación (dedup por nombre)", c2.id === c1.id, `${c2.id} vs ${c1.id}`);
check("el teléfono asciende al número real", getConversationById(c1.id)?.phone === realPhone, getConversationById(c1.id)?.phone);
check("el jid asciende al número real", getConversationById(c1.id)?.jid === `${realPhone}@s.whatsapp.net`, getConversationById(c1.id)?.jid ?? "");

// 3) Un mensaje POSTERIOR por @lid (sin senderPn) NO revierte: sigue siendo el mismo
//    contacto con su número real (no se pierde ni se duplica).
const c3 = getOrCreateConversation(lidPhone, nombre, `${lidPhone}@lid`);
check("un @lid posterior cae en la misma conversación", c3.id === c1.id, `${c3.id} vs ${c1.id}`);
check("no revierte al número largo", getConversationById(c1.id)?.phone === realPhone, getConversationById(c1.id)?.phone);

deleteConversation(c1.id);
check("limpieza", getConversationById(c1.id) === null);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
