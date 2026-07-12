import { NextRequest, NextResponse } from "next/server";
import { insertMessage, enqueueOutbox, getConversationById, getConnectionState } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { conversationId, message } = await req.json();
  if (!conversationId || !message?.trim()) {
    return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });
  }

  const conv = getConversationById(conversationId);
  if (!conv) return NextResponse.json({ ok: false, error: "Conversación no encontrada" }, { status: 404 });

  // No dar por enviado a ciegas: si WhatsApp no está conectado, el mensaje no saldría y
  // Mary creería que sí. Avisar y NO insertar (así no aparece como enviado en el chat).
  if (getConnectionState().status !== "connected") {
    return NextResponse.json({ ok: false, error: "WhatsApp no está conectado. Revisa la conexión (menú Conexión) e inténtalo de nuevo." }, { status: 409 });
  }

  insertMessage(conversationId, "human", message.trim());
  enqueueOutbox(conversationId, conv.phone, message.trim());

  return NextResponse.json({ ok: true });
}
