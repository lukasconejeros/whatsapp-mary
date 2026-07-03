import { NextRequest, NextResponse } from "next/server";
import { listClases, listClasesRange, addClase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (desde && hasta) {
    return NextResponse.json({ ok: true, clases: listClasesRange(desde, hasta) });
  }
  return NextResponse.json({ ok: true, clases: listClases() });
}

export async function POST(req: NextRequest) {
  const b = await req.json() as { fecha?: string; dia?: string; profe?: string; hora?: string; alumnos?: (string | number)[]; nota?: string };
  if (!b.dia || !b.profe) {
    return NextResponse.json({ ok: false, error: "dia y profe son obligatorios" }, { status: 400 });
  }
  const id = addClase({ fecha: b.fecha, dia: b.dia, profe: b.profe, hora: b.hora, alumnos: b.alumnos, nota: b.nota });
  return NextResponse.json({ ok: true, id });
}
