import { NextRequest, NextResponse } from "next/server";
import { updateClaseFija, deleteClaseFija } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const b = await req.json() as {
    dia?: string; hora?: string; horaFin?: string; profe?: string;
    alumnos?: string[]; cuposPrueba?: number; activa?: boolean;
  };
  if (!b.dia || !b.hora) {
    return NextResponse.json({ ok: false, error: "dia y hora son obligatorios" }, { status: 400 });
  }
  updateClaseFija(id, {
    dia: b.dia, hora: b.hora, horaFin: b.horaFin, profe: b.profe || "Mary",
    alumnos: b.alumnos, cuposPrueba: b.cuposPrueba, activa: b.activa,
  });
  return NextResponse.json({ ok: true });
}

// Borrar de verdad. Para "esta clase ya no se hace" es mejor darla de baja
// (activa=false) con PUT: deja de salir en el calendario sin perder quién venía.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteClaseFija(id);
  return NextResponse.json({ ok: true });
}
