import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Guarda una foto que Mary adjunta en el Asistente para enviar a un apoderado.
// La deja en data/media/<name> (mismo lugar que los medios recibidos) y devuelve
// el nombre, que el frontend manda luego junto al texto.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  const rl = limitar(req, "foto", 40); if (rl) return rl;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "falta el archivo" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ ok: false, error: "archivo vacío" }, { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "la foto pesa demasiado (máx 8 MB)" }, { status: 413 });
  }
  const mime = (file.type || "").toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const name = `envio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  } catch (e) {
    console.error("foto:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la foto" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name });
}
