import { NextRequest, NextResponse } from "next/server";
import { listClases, addClase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, clases: listClases() });
}

export async function POST(req: NextRequest) {
  const b = await req.json() as { dia?: string; profe?: string; hora?: string; alumnos?: number[]; nota?: string };
  if (!b.dia || !b.profe) {
    return NextResponse.json({ ok: false, error: "dia y profe son obligatorios" }, { status: 400 });
  }
  const id = addClase({ dia: b.dia, profe: b.profe, hora: b.hora, alumnos: b.alumnos, nota: b.nota });
  return NextResponse.json({ ok: true, id });
}
