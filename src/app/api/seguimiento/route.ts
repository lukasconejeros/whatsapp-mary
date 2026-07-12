import { NextRequest, NextResponse } from "next/server";
import {
  getLeadsParaSeguimiento,
  enqueueSeguimientos,
  enqueueSeguimientoTest,
  omitirSeguimientosPendientes,
  getSeguimientoStats,
  getConversationById,
} from "@/lib/db";
import { todaySantiago } from "@/lib/fechas";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// GET: progreso de la campaña + cuántos leads de Meta (no cerrados) hay para invitar.
export function GET() {
  const stats = getSeguimientoStats(todaySantiago());
  const candidatos = getLeadsParaSeguimiento().length;
  return NextResponse.json({ ok: true, stats, candidatos });
}

// POST { action: 'iniciar' | 'detener' }
//  - iniciar: encola a todos los leads de Meta NO cerrados que no tengan ya un
//    seguimiento pendiente/enviado. El bot los manda solo, con pausas + tope diario.
//  - detener: marca los pendientes como omitidos (no se mandan más).
export async function POST(req: NextRequest) {
  const rl = limitar(req, "seguimiento", 20); if (rl) return rl;
  let body: { action?: string; conversationId?: number };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  const action = body.action ?? "iniciar";

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

  return NextResponse.json({ ok: false, error: "action debe ser iniciar|detener|test" }, { status: 400 });
}
