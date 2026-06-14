import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve(process.cwd(), "data/messages.db"));
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

interface Conv { id: number; phone: string; name: string | null; jid: string | null; mode: string; estado: string }

const all = db.prepare("SELECT * FROM conversations ORDER BY id ASC").all() as Conv[];

// Agrupa por nombre normalizado (dedupable: >= 4 chars)
const groups = new Map<string, Conv[]>();
for (const c of all) {
  const name = (c.name ?? "").trim();
  if (name.length < 4) continue;
  const key = name.toLowerCase();
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(c);
}

function bestJid(convs: Conv[]): string | null {
  const real = convs.find(c => c.jid?.endsWith("@s.whatsapp.net"));
  if (real) return real.jid;
  return convs.find(c => c.jid)?.jid ?? null;
}

let merged = 0;
const mergeTx = db.transaction((primary: Conv, dupes: Conv[]) => {
  const jid = bestJid([primary, ...dupes]);
  // mover mensajes de los duplicados a la conversación primaria
  for (const d of dupes) {
    db.prepare("UPDATE messages SET conversation_id = ? WHERE conversation_id = ?").run(primary.id, d.id);
    db.prepare("DELETE FROM outbox WHERE conversation_id = ?").run(d.id);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(d.id);
  }
  // dejar el mejor jid (número real) en la primaria
  if (jid && jid !== primary.jid) db.prepare("UPDATE conversations SET jid = ? WHERE id = ?").run(jid, primary.id);
});

for (const [key, convs] of groups) {
  if (convs.length < 2) continue;
  const [primary, ...dupes] = convs; // menor id = primaria
  console.log(`Fusionando "${primary.name}" → ${convs.length} conversaciones en 1 (ids: ${convs.map(c => c.id).join(", ")})`);
  mergeTx(primary, dupes);
  merged += dupes.length;
}

db.close();
console.log(merged === 0 ? "No había duplicados que fusionar." : `Listo: ${merged} conversaciones duplicadas fusionadas.`);
