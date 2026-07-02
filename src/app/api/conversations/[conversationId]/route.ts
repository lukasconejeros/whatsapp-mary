import { NextResponse } from "next/server";
import { getMessages, deleteConversation } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteContext { params: Promise<{ conversationId: string }> }

export async function GET(_req: Request, ctx: RouteContext) {
  const { conversationId } = await ctx.params;
  const id = parseInt(conversationId, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id invalido" }, { status: 400 });

  const rows = getMessages(id, 200);
  const messages = rows.map(m => ({
    id:          m.id,
    content:     m.content,
    messageType: m.role === 'user' ? 0 : 1,
    senderName:  m.role === 'user' ? 'Contacto' : m.role === 'human' ? 'Tú' : 'Bot',
    senderType:  m.role,
    createdAt:   m.created_at,
    isPrivate:   false,
    media:       m.media ? `/api/media/${m.media}` : null,
  }));

  return NextResponse.json({ ok: true, messages });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { conversationId } = await ctx.params;
  const id = parseInt(conversationId, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id invalido" }, { status: 400 });
  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
