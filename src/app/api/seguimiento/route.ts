import { NextRequest, NextResponse } from "next/server";
import {
  getLeadsParaSeguimiento,
  enqueueSeguimientos,
  enqueueSeguimientoTest,
  omitirSeguimientosPendientes,
  getSeguimientoStats,
  getConversationById,
  getConfig,
  setConfig,
} from "@/lib/db";
import { todaySantiago } from "@/lib/fechas";
import { SEGUIMIENTO_MSG_KEY, MENSAJE_SEGUIMIENTO_DEFAULT } from "@/lib/seguimiento";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// GET: progreso + cuántos leads en Seguimiento (cerrados) + la plantilla editable.
export function GET() {
  const stats = getSeguimientoStats(todaySantiago());
  const candidatos = getLeadsParaSeguimiento().length;
  const mensaje = getConfig(SEGUIMIENTO_MSG_KEY, MENSAJE_SEGUIMIENTO_DEFAULT);
  return NextResponse.json({ ok: true, stats, candidatos, mensaje });
}

// POST { action }:
//  - guardar { mensaje }: guarda la plantilla editable del seguimiento.
//  - iniciar: encola a los leads en Seguimiento (cerrados) que no tengan ya uno
//    pendiente/enviado. El bot los manda solo, con pausas + tope diario.
//  - detener: marca los pendientes como omitidos (no se mandan más).
//  - test { conversationId }: encola UNA prueba a esa conversación (número propio).
export async function POST(req: NextRequest) {
  const rl = limitar(req, "seguimiento", 20); if (rl) return rl;
  let body: { action?: string; conversationId?: number; mensaje?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  const action = body.action ?? "iniciar";

  if (action === "guardar") {
    const msg = (body.mensaje ?? "").trim();
    if (!msg) return NextResponse.json({ ok: false, error: "el mensaje no puede estar vacío" }, { status: 400 });
    setConfig(SEGUIMIENTO_MSG_KEY, msg);
    return NextResponse.json({ ok: true, mensaje: msg });
  }

  if (action === "detener") {
    const detenidos = omitirSeguimientosPendientes();
    return NextResponse.json({ ok: true, detenidos, stats: getSeguimientoStats(todaySantiago()) });
  }

  if (action === "iniciar") {
    const leads = getLeadsParaSeguimiento().map((l) => ({ id: l.id, phone: l.phone }));
    const agregados = enqueueSeguimientos(leads);
    return NextResponse.json({ ok: true, agregados, stats: getSeguimientoStats(todaySantiago()) });
  }

  if (action === "test") {
    const conv = getConversationById(Number(body.conversationId));
    if (!conv) return NextResponse.json({ ok: false, error: "conversación no encontrada" }, { status: 404 });
    enqueueSeguimientoTest(conv.id, conv.phone);
    return NextResponse.json({ ok: true, stats: getSeguimientoStats(todaySantiago()) });
  }

  return NextResponse.json({ ok: false, error: "action debe ser guardar|iniciar|detener|test" }, { status: 400 });
}
