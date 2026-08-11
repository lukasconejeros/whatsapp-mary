import { NextRequest, NextResponse } from "next/server";
import { asistenciaRango, marcarAsistencia, borrarAsistencia } from "@/lib/db";

export const dynamic = "force-dynamic";

// Quién vino y quién faltó, para pintar los puntitos del calendario.
// El POST es el toque de Mary en la pantalla: corrige lo que el bot entendió mal,
// por eso queda con fuente 'panel'. Sin estado, desmarca (vuelve al punto gris).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json({ ok: false, error: "faltan desde y hasta" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, asistencia: asistenciaRango(desde, hasta) });
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as { fecha?: string; alumno?: string; estado?: string | null };
  if (!b.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha) || !b.alumno?.trim()) {
    return NextResponse.json({ ok: false, error: "fecha (YYYY-MM-DD) y alumno son obligatorios" }, { status: 400 });
  }
  if (b.estado == null) {
    borrarAsistencia(b.fecha, b.alumno);
    return NextResponse.json({ ok: true, estado: null });
  }
  if (b.estado !== "vino" && b.estado !== "falto") {
    return NextResponse.json({ ok: false, error: "estado debe ser vino, falto o nulo" }, { status: 400 });
  }
  marcarAsistencia(b.fecha, b.alumno, b.estado, "panel");
  return NextResponse.json({ ok: true, estado: b.estado });
}
