import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import {
  upsertCliente,
  insertClienteNuevo,
  getClienteByPhone,
  getOrCreateConversation,
  upsertLead,
  deleteConversation,
  insertMessage,
  getMessages,
} from "../src/lib/db.js";

const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
// limpiar datos de pruebas previas
for (const tel of ["56990008001", "56990008002", "56990008003", "56990008004"]) {
  raw.prepare("DELETE FROM conversations WHERE phone = ?").run(tel);
  raw.prepare("DELETE FROM clientes WHERE telefono = ?").run(tel);
}
raw.prepare("DELETE FROM conversations WHERE name IN ('ZitaUnicoQ','LidUnicoQ')").run();

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST integridad DB (seed/dedup/borrado/orden)\n");

// 1) Seed no pisa ediciones manuales.
upsertCliente({ telefono: "+56990008001", nombre: "Editado A Mano", alumnos: "HijoEditado" });
insertClienteNuevo({ telefono: "+56990008001", nombre: "Del Seed", alumnos: "OtroDelSeed" });
const cli = getClienteByPhone("56990008001");
check("insertClienteNuevo NO pisa nombre editado", cli?.nombre === "Editado A Mano", cli?.nombre ?? "");
check("insertClienteNuevo NO pisa alumnos editado", cli?.alumnos === "HijoEditado", cli?.alumnos ?? "");

// 2) Dedup: dos números reales con el MISMO nombre → conversaciones DISTINTAS.
const c1 = getOrCreateConversation("56990008001", "ZitaUnicoQ", "56990008001@s.whatsapp.net");
const c2 = getOrCreateConversation("56990008002", "ZitaUnicoQ", "56990008002@s.whatsapp.net");
check("dos números reales mismo nombre → 2 conversaciones", c1.id !== c2.id, `${c1.id} vs ${c2.id}`);

// 3) Dedup @lid↔número real (mismo contacto) → 1 sola conversación.
const lid = getOrCreateConversation("77770008003", "LidUnicoQ", "77770008003@lid");
const real = getOrCreateConversation("56990008003", "LidUnicoQ", "56990008003@s.whatsapp.net");
check("@lid + número real mismo nombre → misma conversación", lid.id === real.id, `${lid.id} vs ${real.id}`);
check("jid actualizado al número real tras fusionar", real.jid?.endsWith("@s.whatsapp.net") === true, real.jid ?? "");

// 4) Borrar conversación con lead asociado → no lanza y desaparece.
const cd = getOrCreateConversation("56990008004", "BorrarConLead");
upsertLead({ conversationId: cd.id, phone: "56990008004", nombre: "X" });
let borrado = false;
try { deleteConversation(cd.id); borrado = true; } catch { borrado = false; }
check("deleteConversation con lead no lanza", borrado);
check("conversación efectivamente borrada", raw.prepare("SELECT 1 FROM conversations WHERE id=?").get(cd.id) === undefined);
check("lead asociado también borrado", raw.prepare("SELECT 1 FROM leads WHERE conversation_id=?").get(cd.id) === undefined);

// 5) Orden estable: dos mensajes en el mismo segundo salen por id.
const co = getOrCreateConversation("56990008002", "OrdenTest");
const idA = insertMessage(co.id, "user", "primero-orden");
const idB = insertMessage(co.id, "assistant", "segundo-orden");
const msgs = getMessages(co.id, 50).filter(m => m.content.endsWith("-orden"));
check("orden por id (primero antes que segundo)", msgs[0]?.content === "primero-orden" && msgs[1]?.content === "segundo-orden", `${idA},${idB}`);

// limpieza
for (const tel of ["56990008001", "56990008002", "56990008003", "56990008004", "77770008003"]) {
  const rows = raw.prepare("SELECT id FROM conversations WHERE phone = ?").all(tel) as { id: number }[];
  for (const r of rows) { raw.prepare("DELETE FROM messages WHERE conversation_id=?").run(r.id); raw.prepare("DELETE FROM leads WHERE conversation_id=?").run(r.id); raw.prepare("DELETE FROM conversations WHERE id=?").run(r.id); }
  raw.prepare("DELETE FROM clientes WHERE telefono = ?").run(tel);
}
raw.close();

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
