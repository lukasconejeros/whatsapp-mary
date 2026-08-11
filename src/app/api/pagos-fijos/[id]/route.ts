import { NextRequest, NextResponse } from "next/server";
import { updatePagoFijo, deletePagoFijo, type TipoPagoFijo } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const b = await req.json() as {
    tipo?: string; descripcion?: string; monto?: number; diaMes?: number; activo?: boolean;
  };
  if (!b.tipo || !b.diaMes) {
    return NextResponse.json({ ok: false, error: "tipo y día del mes son obligatorios" }, { status: 400 });
  }
  try {
    updatePagoFijo(id, {
      tipo: b.tipo as TipoPagoFijo, descripcion: b.descripcion,
      monto: b.monto ?? 0, diaMes: b.diaMes, activo: b.activo,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

// Borrar de verdad. Para "esto ya no se paga" es mejor darlo de baja (activo=false)
// con PUT: deja de salir en el calendario sin perder lo que se pagaba.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deletePagoFijo(id);
  return NextResponse.json({ ok: true });
}
