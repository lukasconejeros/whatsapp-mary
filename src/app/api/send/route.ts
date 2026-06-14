import { NextRequest, NextResponse } from "next/server";
import { insertMessage, enqueueOutbox, getConversationById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { conversationId, message } = await req.json();
  if (!conversationId || !message?.trim()) {
    return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
  }

  const conv = getConversationById(conversationId);
  if (!conv) return NextResponse.json({ ok: false, error: "Conversación no encontrada" }, { status: 404 });

  insertMessage(conversationId, "human", message.trim());
  enqueueOutbox(conversationId, conv.phone, message.trim());

  return NextResponse.json({ ok: true });
}
