import Database from "better-sqlite3";

const db = new Database("./data/messages.db");

const lids = db.prepare(
  "SELECT id, phone, name FROM conversations WHERE jid LIKE '%@lid'"
).all() as { id: number; phone: string; name: string }[];

if (lids.length === 0) {
  console.log("No hay conversaciones @lid duplicadas.");
} else {
  for (const l of lids) {
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(l.id);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(l.id);
    console.log(`Eliminada: ${l.phone} (${l.name ?? "sin nombre"})`);
  }
}

db.close();
console.log("Listo.");
