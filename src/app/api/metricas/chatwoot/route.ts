import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = new Database(path.resolve(process.cwd(), "data/messages.db"), { readonly: true });
  const now = Math.floor(Date.now() / 1000);

  const total    = (db.prepare("SELECT COUNT(*) as n FROM conversations").get() as { n: number }).n;
  const total30d = (db.prepare("SELECT COUNT(*) as n FROM conversations WHERE COALESCE(last_message_at, created_at) > ?").get(now - 30 * 86400) as { n: number }).n;
  const botActive= (db.prepare("SELECT COUNT(*) as n FROM conversations WHERE mode = 'AI'").get() as { n: number }).n;
  const botOff   = (db.prepare("SELECT COUNT(*) as n FROM conversations WHERE mode = 'HUMAN'").get() as { n: number }).n;
  const sinResp  = (db.prepare("SELECT COUNT(*) as n FROM conversations WHERE mode = 'AI' AND COALESCE(last_message_at, created_at) < ?").get(now - 86400) as { n: number }).n;
  db.close();

  return NextResponse.json({
    ok: true, total, total30d,
    byState: { activo: botActive, derivado: botOff, agendado: 0, cancelado: 0, resuelto: 0 },
    byChannel: { whatsapp: total, instagram: 0, messenger: 0, tiktok: 0, unknown: 0 },
    botActive, botOff, reactivados: 0, sinRespuesta: sinResp,
  });
}
