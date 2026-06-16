import { NextRequest, NextResponse } from "next/server";
import { updateCosto, deleteCosto } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const b = await req.json() as { fecha?: string; tipo?: string; cantidad?: number; valor?: number; notas?: string };
  if (!b.fecha || typeof b.valor !== "number") {
    return NextResponse.json({ ok: false, error: "fecha y valor son obligatorios" }, { status: 400 });
  }
  updateCosto(id, { fecha: b.fecha, tipo: b.tipo, cantidad: b.cantidad, valor: b.valor, notas: b.notas });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteCosto(id);
  return NextResponse.json({ ok: true });
}
