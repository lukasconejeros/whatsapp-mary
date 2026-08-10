import { NextRequest, NextResponse } from "next/server";
import { listClasesFijas, addClaseFija } from "@/lib/db";

export const dynamic = "force-dynamic";

// Las clases que se repiten todas las semanas. Devuelve TODAS (activas y dadas de
// baja): quien pinta el calendario filtra, pero la pantalla de administración las
// necesita completas para poder reactivar una.
export async function GET() {
  return NextResponse.json({ ok: true, clasesFijas: listClasesFijas() });
}

export async function POST(req: NextRequest) {
  const b = await req.json() as {
    dia?: string; hora?: string; horaFin?: string; profe?: string;
    alumnos?: string[]; cuposPrueba?: number; activa?: boolean;
  };
  if (!b.dia || !b.hora) {
    return NextResponse.json({ ok: false, error: "dia y hora son obligatorios" }, { status: 400 });
  }
  const id = addClaseFija({
    dia: b.dia, hora: b.hora, horaFin: b.horaFin, profe: b.profe || "Mary",
    alumnos: b.alumnos, cuposPrueba: b.cuposPrueba, activa: b.activa,
  });
  return NextResponse.json({ ok: true, id });
}
