import { NextRequest, NextResponse } from "next/server";
import {
  getLeadsMeta,
  getLeadsSeguimiento,
  enqueueSeguimientos,
  enqueueSeguimientoTest,
  omitirSeguimientosPendientes,
  getSeguimientoStats,
  getConversationById,
  getClienteByPhone,
  getConfig,
  setConfig,
} from "@/lib/db";
import { todaySantiago } from "@/lib/fechas";
import {
  MSG_META_KEY, MSG_SEGUIMIENTO_KEY, MENSAJE_META_DEFAULT, MENSAJE_SEGUIMIENTO_DEFAULT, personalizarMensaje,
} from "@/lib/seguimiento";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const keyDe = (tipo: string) => (tipo === "meta" ? MSG_META_KEY : MSG_SEGUIMIENTO_KEY);
const defDe = (tipo: string) => (tipo === "meta" ? MENSAJE_META_DEFAULT : MENSAJE_SEGUIMIENTO_DEFAULT);

// GET: progreso + candidatos de cada audiencia + las dos plantillas editables.
export function GET() {
  return NextResponse.json({
    ok: true,
    stats: getSeguimientoStats(todaySantiago()),
    candMeta: getLeadsMeta().length,
    candSeguimiento: getLeadsSeguimiento().length,
    msgMeta: getConfig(MSG_META_KEY, MENSAJE_META_DEFAULT),
    msgSeguimiento: getConfig(MSG_SEGUIMIENTO_KEY, MENSAJE_SEGUIMIENTO_DEFAULT),
  });
}

// POST { action, tipo?: 'meta'|'seguimiento' }
//  - guardar { tipo, mensaje }: guarda la plantilla de ese envío.
//  - iniciar { tipo }: encola a la audiencia de ese envío con SU mensaje personalizado.
//  - test { conversationId }: encola UNA prueba a esa conversación con el mensaje que
//    corresponda (Meta si está abierta, Seguimiento si está cerrada).
//  - detener: cancela todos los pendientes (de ambos envíos, es una sola cola).
export async function POST(req: NextRequest) {
  const rl = limitar(req, "seguimiento", 20); if (rl) return rl;
  let body: { action?: string; tipo?: string; conversationId?: number; mensaje?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  const action = body.action ?? "iniciar";
  const tipo = body.tipo === "meta" ? "meta" : "seguimiento";

  if (action === "guardar") {
    const msg = (body.mensaje ?? "").trim();
    if (!msg) return NextResponse.json({ ok: false, error: "el mensaje no puede estar vacío" }, { status: 400 });
    setConfig(keyDe(tipo), msg);
    return NextResponse.json({ ok: true });
  }

  if (action === "detener") {
    const detenidos = omitirSeguimientosPendientes();
    return NextResponse.json({ ok: true, detenidos, stats: getSeguimientoStats(todaySantiago()) });
  }

  if (action === "iniciar") {
    const template = getConfig(keyDe(tipo), defDe(tipo));
    const leads = tipo === "meta" ? getLeadsMeta() : getLeadsSeguimiento();
    const items = leads.map((l) => ({
      id: l.id, phone: l.phone,
      mensaje: personalizarMensaje(template, l.name, getClienteByPhone(l.phone)?.alumnos ?? null),
    }));
    const agregados = enqueueSeguimientos(items);
    return NextResponse.json({ ok: true, agregados, stats: getSeguimientoStats(todaySantiago()) });
  }

  if (action === "test") {
    const conv = getConversationById(Number(body.conversationId));
    if (!conv) return NextResponse.json({ ok: false, error: "conversación no encontrada" }, { status: 404 });
    const t = conv.cerrado ? "seguimiento" : "meta";
    const template = getConfig(keyDe(t), defDe(t));
    const mensaje = personalizarMensaje(template, conv.name, getClienteByPhone(conv.phone)?.alumnos ?? null);
    enqueueSeguimientoTest(conv.id, conv.phone, mensaje);
    return NextResponse.json({ ok: true, stats: getSeguimientoStats(todaySantiago()) });
  }

  return NextResponse.json({ ok: false, error: "action debe ser guardar|iniciar|detener|test" }, { status: 400 });
}
