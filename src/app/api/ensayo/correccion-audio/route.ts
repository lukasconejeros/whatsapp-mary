import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { guardarCorreccionAudio } from "@/lib/db";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Mary graba con el micrófono del teléfono lo que ELLA le diría al apoderado. El
// archivo se guarda tal cual en data/media (volumen persistente): esto no se le manda
// a nadie, lo escuchamos después para armar el cerebro definitivo del bot.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const MAX_BYTES = 16 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const rl = limitar(req, "correccion-audio", 60);
  if (rl) return rl;

  const form = await req.formData();
  const file = form.get("file");
  const id = Number(form.get("id"));
  const segundos = Math.max(0, Math.round(Number(form.get("segundos")) || 0));
  if (!Number.isFinite(id) || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Faltan datos (id, file)" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  if (!mime.startsWith("audio/")) {
    return NextResponse.json({ ok: false, error: "solo audio" }, { status: 415 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return NextResponse.json({ ok: false, error: "archivo vacío" }, { status: 400 });
  if (buffer.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "archivo muy grande" }, { status: 413 });

  const ext = mime.includes("webm")
    ? "webm"
    : mime.includes("mp4") || mime.includes("m4a")
      ? "m4a"
      : mime.includes("mpeg")
        ? "mp3"
        : "ogg";
  const name = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  } catch (e) {
    console.error("correccion-audio:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el audio" }, { status: 500 });
  }

  const ok = guardarCorreccionAudio(id, name, segundos);
  return NextResponse.json({ ok, media: name, segundos }, { status: ok ? 200 : 404 });
}
