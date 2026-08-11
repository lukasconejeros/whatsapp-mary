import "./env-loader.js";
import { modoAutomatico, puedeDecidirElSistema, esLeadDeAnuncio } from "../src/lib/quien-contesta.js";
import {
  getOrCreateConversation,
  getConversationById,
  setCategoria,
  setCtwaReferral,
  setMode,
  setModeAutomatico,
  deleteConversation,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST a quién le contesta el bot de Arteluk\n");

// ── La familia COMPLETA de quien le escribe a Mary ────────────────────────────
console.log("— la decisión, caso por caso —");
check("lead de un anuncio de Meta → contesta el bot", modoAutomatico("potencial") === "AI");
check("número desconocido → contesta el bot (el filtro del prompt decide)", modoAutomatico("mary") === "AI");
check("apoderado ya inscrito → callado, lo ve Mary", modoAutomatico("arteluk") === "HUMAN");

console.log("\n— la decisión de Mary manda sobre el automático —");
check("nadie la tocó → el sistema decide", puedeDecidirElSistema({ mode_manual: 0 }));
check("Mary tocó el interruptor → el sistema NO decide", !puedeDecidirElSistema({ mode_manual: 1 }));
check("columna vieja sin valor → el sistema decide", puedeDecidirElSistema({}));

console.log("\n— derecho a respuesta del lead pagado —");
check("categoría potencial → es lead de anuncio", esLeadDeAnuncio({ categoria: "potencial" }));
check("guarda la señal CTWA aunque lo hayan recategorizado", esLeadDeAnuncio({ categoria: "mary", ctwa_referral: '{"source":"ctwa_ad"}' }));
check("apoderado normal → no es lead de anuncio", !esLeadDeAnuncio({ categoria: "arteluk", ctwa_referral: null }));

// ── Contra la base de verdad ──────────────────────────────────────────────────
console.log("\n— contra SQLite —");
const phone = "56900000TESTQUIEN";
const conv = getOrCreateConversation(phone, "Lead Prueba Quien Contesta");
check("nace apagado y sin decisión manual", getConversationById(conv.id)?.mode === "HUMAN" && !getConversationById(conv.id)?.mode_manual);

// Llega por un anuncio: el sistema lo enciende.
setCategoria(conv.id, "potencial", false);
setCtwaReferral(conv.id, { source: "ctwa_ad", title: "Clases de arte" });
setModeAutomatico(conv.id, modoAutomatico("potencial"));
check("lead de anuncio → el bot queda encendido", getConversationById(conv.id)?.mode === "AI");
check("y NO queda marcado como decisión manual", !getConversationById(conv.id)?.mode_manual);

// Mary contesta: el bot se apaga y la decisión pasa a ser suya.
setMode(conv.id, "HUMAN");
check("contesta Mary → el bot se apaga", getConversationById(conv.id)?.mode === "HUMAN");
check("y queda marcado como decisión manual", getConversationById(conv.id)?.mode_manual === 1);

// El automático ya no puede pisarla, aunque siga llegando como lead de anuncio.
setModeAutomatico(conv.id, "AI");
check("el automático YA NO vuelve a encenderlo", getConversationById(conv.id)?.mode === "HUMAN");

// Y si Mary lo enciende a mano, tampoco se lo apaga el automático.
setMode(conv.id, "AI");
setModeAutomatico(conv.id, "HUMAN");
check("si Mary lo enciende a mano, el automático tampoco lo apaga", getConversationById(conv.id)?.mode === "AI");

deleteConversation(conv.id);
check("limpieza: conversación de prueba borrada", getConversationById(conv.id) === null);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
