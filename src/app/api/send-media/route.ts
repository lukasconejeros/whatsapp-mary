import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getConversationById, insertMessage, enqueueOutbox } from "@/lib/db";

export const dynamic = "force-dynamic";

// Envía una nota de voz o una foto a un contacto desde el chat.
// Multipart: conversationId + file. Guarda el archivo en data/media, lo registra
// en el chat como enviado por Mary y lo encola para que el bot lo mande.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const MAX_BYTES = 16 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const conversationId = Number(form.get("conversationId"));
  if (!conversationId || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Faltan datos (conversationId, file)" }, { status: 400 });
  }
  const conv = getConversationById(conversationId);
  if (!conv) return NextResponse.json({ ok: false, error: "Conversación no encontrada" }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return NextResponse.json({ ok: false, error: "archivo vacío" }, { status: 400 });
  if (buffer.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "archivo muy grande" }, { status: 413 });

  const mime = (file.type || "").toLowerCase();
  const esAudio = mime.startsWith("audio/");
  const esImagen = mime.startsWith("image/");
  if (!esAudio && !esImagen) {
    return NextResponse.json({ ok: false, error: "tipo no soportado (solo audio o imagen)" }, { status: 415 });
  }

  let ext: string;
  if (esAudio) ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("mpeg") ? "mp3" : "ogg";
  else ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const name = `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  const kind = esAudio ? "audio" : "image";
  const placeholder = esAudio ? "🎤 Audio" : "📷 Foto";
  // Se registra en el chat (role human) y se encola para el envío real por WhatsApp.
  insertMessage(conv.id, "human", placeholder, name);
  enqueueOutbox(conv.id, conv.phone, esImagen ? "" : "", { kind, media: name });

  return NextResponse.json({ ok: true, media: name, kind });
}
