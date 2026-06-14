import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = new Database(path.resolve(process.cwd(), "data/messages.db"), { readonly: true });
  const now = Math.floor(Date.now() / 1000);

  const totalLeads  = (db.prepare("SELECT COUNT(*) as n FROM leads").get() as { n: number }).n;
  const nuevos      = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'nuevo'").get() as { n: number }).n;
  const calificados = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'calificado'").get() as { n: number }).n;
  const demos       = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'demo'").get() as { n: number }).n;
  const clientes    = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE estado = 'cliente'").get() as { n: number }).n;
  const leads30d    = (db.prepare("SELECT COUNT(*) as n FROM leads WHERE created_at > ?").get(now - 30 * 86400) as { n: number }).n;
  db.close();

  return NextResponse.json({
    ok: true, totalLeads, nuevos, calificados, demos, clientes, leads30d,
    agendadas: demos, atendidas: clientes, canceladas: 0, inasistencias: 0,
    tasaAsistencia: demos > 0 ? Math.round((clientes / demos) * 100) : 0,
    tasaAusentismo: 0, lastUpdated: new Date().toISOString(), cached: false,
  });
}
