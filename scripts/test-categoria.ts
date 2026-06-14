import "./env-loader.js";
import {
  getOrCreateConversation,
  getConversationById,
  setCategoria,
  upsertCliente,
  getClienteByPhone,
  deleteConversation,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST categoria + clientes\n");

// nace en HUMAN (sin chatbot) y categoría default 'mary'
const conv = getOrCreateConversation("56900000001", "Test Cat", "56900000001@s.whatsapp.net");
const fresh = getConversationById(conv.id)!;
check("nace en modo HUMAN", fresh.mode === "HUMAN", `(${fresh.mode})`);
check("categoria default = mary", fresh.categoria === "mary", `(${fresh.categoria})`);
check("categoria_manual default = 0", fresh.categoria_manual === 0, `(${fresh.categoria_manual})`);

// override manual marca categoria_manual=1
setCategoria(conv.id, "arteluk", true);
const moved = getConversationById(conv.id)!;
check("setCategoria mueve a arteluk", moved.categoria === "arteluk");
check("override marca categoria_manual=1", moved.categoria_manual === 1);

// clientes
upsertCliente({ nombre: "Cliente Demo", telefono: "+56 9 0000 0002", airtableId: "recXYZ" });
const cli = getClienteByPhone("56900000002");
check("getClienteByPhone normaliza y encuentra", !!cli && cli.nombre === "Cliente Demo", `(${JSON.stringify(cli)})`);

// limpieza
deleteConversation(conv.id);
console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
