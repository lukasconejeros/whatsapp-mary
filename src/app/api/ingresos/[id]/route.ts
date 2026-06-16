import { NextRequest, NextResponse } from "next/server";
import { updateIngreso, deleteIngreso } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const b = await req.json() as { fecha?: string; apoderado?: string; monto?: number; tipo?: string; detalle?: string };
  if (!b.fecha || typeof b.monto !== "number") {
    return NextResponse.json({ ok: false, error: "fecha y monto son obligatorios" }, { status: 400 });
  }
  updateIngreso(id, { fecha: b.fecha, apoderado: b.apoderado, monto: b.monto, tipo: b.tipo, detalle: b.detalle });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteIngreso(id);
  return NextResponse.json({ ok: true });
}
