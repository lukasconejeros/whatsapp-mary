import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getConversationById, insertMessage, enqueueOutbox } from "@/lib/db";

export const dynamic = "force-dynamic";

const execFileP = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

// Convierte cualquier audio (webm/mp4/m4a…) a ogg/opus mono 48kHz, que es lo que
// WhatsApp necesita para reproducir una nota de voz. Devuelve el nombre del .ogg
// o null si falla (ffmpeg ausente, etc.).
async function aOggOpus(srcName: string): Promise<string | null> {
  const inPath = path.join(MEDIA_DIR, srcName);
  const oggName = srcName.replace(/\.[^.]+$/, "") + "_voz.ogg";
  const outPath = path.join(MEDIA_DIR, oggName);
  try {
    await execFileP(FFMPEG, ["-y", "-i", inPath, "-vn", "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1", "-f", "ogg", outPath]);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return oggName;
    return null;
  } catch {
    return null;
  }
}

// Duración en segundos (entera) de un archivo de audio, con ffprobe. 0 si falla.
async function duracionSeg(name: string): Promise<number> {
  try {
    const { stdout } = await execFileP(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(MEDIA_DIR, name)]);
    return Math.max(0, Math.round(parseFloat(stdout.trim()) || 0));
  } catch {
    return 0;
  }
}

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
  // En el chat se guarda el archivo ORIGINAL (se escucha bien en el navegador).
  insertMessage(conv.id, "human", placeholder, name);

  // Para WhatsApp, el audio se manda como ogg/opus (si ffmpeg está disponible);
  // si la conversión falla, se manda el original como último recurso. Guardamos la
  // duración en 'content' para pasarla como 'seconds' a WhatsApp (si no, marca 0:00).
  let outMedia = name;
  let contentMeta = "";
  if (esAudio) {
    const ogg = await aOggOpus(name);
    if (ogg) outMedia = ogg;
    const secs = await duracionSeg(outMedia);
    contentMeta = secs > 0 ? String(secs) : "";
  }
  enqueueOutbox(conv.id, conv.phone, contentMeta, { kind, media: outMedia });

  return NextResponse.json({ ok: true, media: name, kind, enviado: outMedia, seg: contentMeta });
}
