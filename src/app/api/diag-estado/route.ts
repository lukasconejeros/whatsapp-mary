import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { listPushSubs } from "@/lib/db";

export const dynamic = "force-dynamic";

// Diagnóstico TEMPORAL del estado real: conexión del bot, últimos mensajes (categoría
// + rol), y suscripciones push. Protegido con un token en la URL. Quitar cuando
// terminemos de depurar. No expone contenido de mensajes ni teléfonos completos.
const TOKEN = "arteluk-diag-9f3";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ ok: false, error: "no" }, { status: 401 });
  }

  // ?test=push → manda una notificación de PRUEBA y REPORTA el resultado real de cada
  // envío (código de estado del servicio de push + error), para diagnosticar la entrega.
  if (req.nextUrl.searchParams.get("test") === "push") {
    const subs = listPushSubs();
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:x@arteluk.cl",
      process.env.VAPID_PUBLIC_KEY || "",
      process.env.VAPID_PRIVATE_KEY || ""
    );
    const payload = JSON.stringify({ titulo: "Prueba Arteluk 🎨", cuerpo: "Si ves esto, las notificaciones funcionan.", url: "/inbox" });
    const resultados: unknown[] = [];
    for (const s of subs) {
      const servicio = s.endpoint.startsWith("https://web.push.apple.com") ? "apple/iOS"
        : s.endpoint.includes("fcm") || s.endpoint.includes("google") ? "google/android"
        : "otro";
      try {
        const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        resultados.push({ ok: true, statusCode: r.statusCode, servicio });
      } catch (e) {
        const err = e as { statusCode?: number; body?: string; message?: string };
        resultados.push({ ok: false, statusCode: err.statusCode ?? null, servicio, error: (err.body || err.message || "").slice(0, 200) });
      }
    }
    return NextResponse.json({ ok: true, subs: subs.length, resultados });
  }

  const db = new Database(path.resolve(process.cwd(), "data/messages.db"), { readonly: true });
  try {
    const conn = db.prepare("SELECT status, updated_at FROM connection_state WHERE id=1").get() as
      | { status: string; updated_at: number } | undefined;
    const pushSubs = (db.prepare("SELECT COUNT(*) n FROM push_subs").get() as { n: number }).n;
    const vapid = !!process.env.VAPID_PUBLIC_KEY;
    const ahora = Math.floor(Date.now() / 1000);
    const ultimas = db.prepare(`
      SELECT c.categoria, c.mode, c.last_message_at,
        substr(c.phone, -4) AS tel4,
        (SELECT role FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1) AS ultimo_role,
        (SELECT length(content) FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC, id DESC LIMIT 1) AS ultimo_len
      FROM conversations c
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 8
    `).all() as Array<{ categoria: string; mode: string; last_message_at: number | null; tel4: string; ultimo_role: string | null; ultimo_len: number | null }>;
    const conMapeo = ultimas.map((u) => ({
      ...u,
      hace_seg: u.last_message_at ? ahora - u.last_message_at : null,
    }));
    return NextResponse.json({
      ok: true,
      conexion: conn?.status ?? "?",
      conexion_hace_seg: conn ? ahora - conn.updated_at : null,
      vapid,
      pushSubs,
      ultimas: conMapeo,
    });
  } finally {
    db.close();
  }
}
