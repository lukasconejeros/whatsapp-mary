import { NextRequest, NextResponse } from "next/server";
import { deleteMovimiento } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteMovimiento(id);
  return NextResponse.json({ ok: true });
}
