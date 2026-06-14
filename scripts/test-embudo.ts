import "./env-loader.js";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
  setMode,
  setEstado,
  deleteConversation,
} from "../src/lib/db.js";
import { marcarInteres } from "../src/lib/tools/marcar-interes.js";
import { generateReply } from "../src/lib/ai.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

async function main() {
  console.log("\n🧪 TEST EMBUDO + DEDUP + SILENCIADO — Waly/Orion\n");

  // ────────────────────────────────────────────────────────────
  console.log("1) Deduplicación LID ↔ número real");
  const NAME = "Juan Pérez TestE2E";
  // Primer contacto por número real
  const a = getOrCreateConversation("56911111111", NAME, "56911111111@s.whatsapp.net");
  insertMessage(a.id, "user", "hola");
  // Mismo contacto vuelve con un LID distinto (otro identificador)
  const b = getOrCreateConversation("273645182930273", NAME, "273645182930273@lid");

  check("mismo contacto NO se duplica (mismo id)", a.id === b.id, `(a=${a.id} b=${b.id})`);
  check("conserva el JID de número real para responder",
    (getConversationById(a.id)?.jid ?? "").endsWith("@s.whatsapp.net"));

  // ────────────────────────────────────────────────────────────
  console.log("\n2) Estados del embudo");
  const conv = getConversationById(a.id)!;
  check("estado inicial = activo", conv.estado === "activo", `(${conv.estado})`);

  await marcarInteres({ conversationId: a.id });
  check("tras marcar_interes → resuelto (quiere agendar)",
    getConversationById(a.id)?.estado === "resuelto");

  setEstado(a.id, "agendado");
  check("tras agendar → agendado", getConversationById(a.id)?.estado === "agendado");

  setMode(a.id, "HUMAN");
  check("derivar a humano → mode HUMAN", getConversationById(a.id)?.mode === "HUMAN");

  // limpieza del caso 1-2
  deleteConversation(a.id);

  // ────────────────────────────────────────────────────────────
  console.log("\n3) Silenciado inteligente (LLM)");

  // 3a. Mensaje personal/cotidiano → debe silenciarse
  const personal = getOrCreateConversation("56922222222", "Compadre", "56922222222@s.whatsapp.net");
  insertMessage(personal.id, "user", "wena lucas como estai compadre");
  const r1 = await generateReply({
    history: getRecentHistory(personal.id, 20),
    conversationId: personal.id,
    phone: "56922222222",
  });
  const personalFresh = getConversationById(personal.id);
  check("mensaje personal → bot NO responde (texto vacío)", r1.trim() === "", `(respondió: "${r1.slice(0,40)}")`);
  check("mensaje personal → conversación queda en HUMAN (silenciada)", personalFresh?.mode === "HUMAN");
  deleteConversation(personal.id);

  // 3b. Lead real de Orion → NO debe silenciarse
  const lead = getOrCreateConversation("56933333333", "Dra Soto", "56933333333@s.whatsapp.net");
  insertMessage(lead.id, "user", "hola, vi su anuncio. tengo una clínica dental y quiero info de orion");
  const r2 = await generateReply({
    history: getRecentHistory(lead.id, 20),
    conversationId: lead.id,
    phone: "56933333333",
  });
  const leadFresh = getConversationById(lead.id);
  check("lead real → bot SÍ responde (texto no vacío)", r2.trim().length > 0);
  check("lead real → NO se silencia (sigue en AI)", leadFresh?.mode === "AI");
  console.log(`     ↳ respuesta bot: "${r2.slice(0, 90)}${r2.length > 90 ? "…" : ""}"`);
  deleteConversation(lead.id);

  // ────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(48)}`);
  console.log(`Resultado: ${pass} ✅   ${fail} ❌`);
  console.log("─".repeat(48));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
