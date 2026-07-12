import { NextResponse } from "next/server";
import { setCerrado } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

// Marca/desmarca un lead de Meta como CERRADO. Body: { cerrado: boolean }.
export async function POST(req: Request, ctx: RouteContext) {
  const { conversationId } = await ctx.params;
  const id = parseInt(conversationId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ ok: false, error: "id invalido" }, { status: 400 });
  }
  const body = (await req.json()) as { cerrado?: boolean };
  const cerrado = !!body.cerrado;
  setCerrado(id, cerrado);
  return NextResponse.json({ ok: true, cerrado });
}
