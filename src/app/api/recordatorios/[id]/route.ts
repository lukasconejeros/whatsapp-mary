import { NextRequest, NextResponse } from "next/server";
import { updateRecordatorio, deleteRecordatorio } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const b = await req.json() as {
    fecha?: string; hora?: string; texto?: string; avisar?: boolean; hecho?: boolean;
  };
  if (!b.fecha || !b.texto?.trim()) {
    return NextResponse.json({ ok: false, error: "fecha y descripción son obligatorias" }, { status: 400 });
  }
  updateRecordatorio(id, { fecha: b.fecha, hora: b.hora, texto: b.texto, avisar: b.avisar, hecho: b.hecho });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteRecordatorio(id);
  return NextResponse.json({ ok: true });
}
