import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getConversationById, insertMessage, enqueueOutbox } from "@/lib/db";
import { limitar } from "@/lib/ratelimit";
import { prepararNotaVoz } from "@/lib/audio";

export const dynamic = "force-dynamic";

// Envía una nota de voz o una foto a un contacto desde el chat.
// Multipart: conversationId + file. Guarda el archivo en data/media, lo registra
// en el chat como enviado por Mary y lo encola para que el bot lo mande.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const MAX_BYTES = 16 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const rl = limitar(req, "send-media", 30); if (rl) return rl;
  const form = await req.formData();
  const file = form.get("file");
  const conversationId = Number(form.get("conversationId"));
  // Pista de duración: el cliente cuenta los segundos mientras graba. Se usa como
  // último recurso si ffprobe no logra sacar la duración (mp4 fragmentado de Safari).
  const hintSeg = Math.max(0, Math.round(Number(form.get("segundos")) || 0));
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
    console.error("send-media:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el archivo" }, { status: 500 });
  }

  const kind = esAudio ? "audio" : "image";
  const placeholder = esAudio ? "🎤 Audio" : "📷 Foto";
  // En el chat se guarda el archivo ORIGINAL (se escucha bien en el navegador).
  insertMessage(conv.id, "human", placeholder, name);

  // Para WhatsApp, el audio se manda como ogg/opus (si ffmpeg está disponible);
  // si la conversión falla, se manda el original como último recurso. Guardamos la
  // duración en 'content' para pasarla como 'seconds' a WhatsApp (si no, marca 0:00).
  let outMedia = name;
  let contentMeta = "";
  if (esAudio) {
    const { outName, seconds, ffmpegOk } = await prepararNotaVoz(MEDIA_DIR, name, hintSeg);
    outMedia = outName;
    contentMeta = seconds > 0 ? String(seconds) : "";
    console.log(`send-media audio: mime=${mime} ffmpegOk=${ffmpegOk} seconds=${seconds} hint=${hintSeg} out=${outName}`);
  }
  enqueueOutbox(conv.id, conv.phone, contentMeta, { kind, media: outMedia });

  return NextResponse.json({ ok: true, media: name, kind, enviado: outMedia, seg: contentMeta });
}
