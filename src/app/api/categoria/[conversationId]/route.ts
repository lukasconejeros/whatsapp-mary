import { NextResponse } from "next/server";
import { setCategoria, type Categoria } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

const VALID: Categoria[] = ["mary", "arteluk", "potencial"];

export async function POST(req: Request, ctx: RouteContext) {
  const { conversationId } = await ctx.params;
  const id = parseInt(conversationId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ ok: false, error: "id invalido" }, { status: 400 });
  }
  const body = (await req.json()) as { categoria?: string };
  if (!body.categoria || !VALID.includes(body.categoria as Categoria)) {
    return NextResponse.json(
      { ok: false, error: "categoria debe ser mary|arteluk|potencial" },
      { status: 400 }
    );
  }
  // manual=true: el override de la usuaria es la verdad final.
  setCategoria(id, body.categoria as Categoria, true);
  return NextResponse.json({ ok: true, categoria: body.categoria });
}
