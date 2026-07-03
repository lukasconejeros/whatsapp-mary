import { NextRequest, NextResponse } from "next/server";
import { updateClase, deleteClase } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const b = await req.json() as { fecha?: string; dia?: string; profe?: string; hora?: string; alumnos?: (string | number)[]; nota?: string };
  if (!b.dia || !b.profe) {
    return NextResponse.json({ ok: false, error: "dia y profe son obligatorios" }, { status: 400 });
  }
  updateClase(id, { fecha: b.fecha, dia: b.dia, profe: b.profe, hora: b.hora, alumnos: b.alumnos, nota: b.nota });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteClase(id);
  return NextResponse.json({ ok: true });
}
