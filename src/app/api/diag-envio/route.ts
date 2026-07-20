import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { getConnectionState } from "@/lib/db";

// TEMPORAL — diagnóstico del ENVÍO: estado de conexión + cola del outbox (pendientes,
// enviados y DESCARTADOS). Sirve para confirmar por qué un mensaje no llegó y para
// verificar el arreglo. Se elimina tras verificar. Se autoprotege con token.
export const dynamic = "force-dynamic";
const TOKEN = "8df4b007fc7b089e218c4dc4c8050a5b";

export function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }
  const db = new Database(path.resolve(process.cwd(), "data/messages.db"), { readonly: false });
  try {
    // sent: 0=pendiente, 1=enviado, 2=descartado tras 5 intentos
    const conteo = db.prepare("SELECT sent, COUNT(*) AS n FROM outbox GROUP BY sent").all() as { sent: number; n: number }[];
    const pendientes = db.prepare("SELECT id, conversation_id, phone, kind, attempts, created_at, substr(content,1,60) AS preview FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT 20").all();
    const fallidos = db.prepare("SELECT id, conversation_id, phone, kind, attempts, created_at, substr(content,1,60) AS preview FROM outbox WHERE sent = 2 ORDER BY created_at DESC LIMIT 20").all();
    const ultimos = db.prepare("SELECT id, phone, kind, sent, attempts, created_at FROM outbox ORDER BY id DESC LIMIT 10").all();

    // Reencolar los descartados (sent=2 -> 0) para que salgan ahora: ?requeue=1
    let reencolados = 0;
    if (req.nextUrl.searchParams.get("requeue") === "1") {
      reencolados = db.prepare("UPDATE outbox SET sent = 0, attempts = 0 WHERE sent = 2").run().changes as number;
    }

    // Salud de la RECEPCIÓN (arreglo de mensajes perdidos): que exista la tabla de
    // dedup y cuántos ids lleva registrados = prueba de que el bot está procesando
    // los "append" (re-entrega tras reconexión) sin duplicar.
    let recepcion: Record<string, unknown>;
    try {
      const n = db.prepare("SELECT COUNT(*) AS n FROM processed_msgs").get() as { n: number };
      const ult = db.prepare("SELECT wa_id, created_at FROM processed_msgs ORDER BY created_at DESC LIMIT 5").all();
      recepcion = { dedupTabla: true, idsRegistrados: n.n, ultimos: ult };
    } catch {
      recepcion = { dedupTabla: false, nota: "processed_msgs no existe — el fix NO está activo" };
    }
    // Últimos mensajes ENTRANTES guardados, para confirmar que siguen llegando.
    const entrantes = db.prepare(
      "SELECT m.id, m.conversation_id, m.created_at, substr(m.content,1,50) AS preview " +
      "FROM messages m WHERE m.role = 'user' ORDER BY m.id DESC LIMIT 8"
    ).all();

    return NextResponse.json({
      ok: true,
      conexion: getConnectionState(),
      recepcion,
      entrantes,
      conteo,
      pendientes,
      fallidos,
      ultimos,
      reencolados,
    });
  } finally {
    db.close();
  }
}
