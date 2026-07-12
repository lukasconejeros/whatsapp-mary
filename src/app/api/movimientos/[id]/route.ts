import { NextRequest, NextResponse } from "next/server";
import { deleteMovimiento } from "@/lib/db";
import { autorizadoMaquina } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, ctx: Ctx) {
  if (!(await autorizadoMaquina(req))) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteMovimiento(id);
  return NextResponse.json({ ok: true });
}
