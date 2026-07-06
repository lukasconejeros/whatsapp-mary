import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateConversation,
  insertMessage,
  enqueueOutbox,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Envío directo a un número arbitrario (no requiere conversación previa).
 * Pensado para integraciones externas (n8n: confirmaciones del calendario web).
 *
 * POST { phone: "+56912345678", message: "..." }
 * Header opcional: x-send-secret — si SEND_DIRECT_SECRET está definido en el
 * entorno, el header debe coincidir (obligatorio en deploy público).
 */
export async function POST(req: NextRequest) {
  // Secreto OBLIGATORIO: sin él, este endpoint permitiría enviar WhatsApp a números
  // arbitrarios desde el número del negocio. Si no está configurado, queda deshabilitado.
  const secret = process.env.SEND_DIRECT_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Endpoint deshabilitado (falta SEND_DIRECT_SECRET)" }, { status: 503 });
  }
  if (req.headers.get("x-send-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const { phone, message } = await req.json();
  const text = typeof message === "string" ? message.trim() : "";
  const rawPhone = typeof phone === "string" ? phone.replace(/[^\d]/g, "") : "";
  if (!rawPhone || !text) {
    return NextResponse.json({ ok: false, error: "Faltan datos (phone, message)" }, { status: 400 });
  }

  // Normaliza a formato chileno con código país, igual que el resto del kit
  let normalized = rawPhone;
  if (normalized.length === 9) normalized = "56" + normalized;
  if (!normalized.startsWith("56")) normalized = "56" + normalized;

  const conv = getOrCreateConversation(normalized);
  insertMessage(conv.id, "human", text);
  enqueueOutbox(conv.id, conv.phone, text);

  return NextResponse.json({ ok: true, conversationId: conv.id });
}
