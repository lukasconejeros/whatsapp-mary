import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { addAudioMary, listAudiosMary, updateAudioMary, deleteAudioMary } from "@/lib/db";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Los audios que Mary graba con su voz. Se guardan tal cual en data/media (volumen
// persistente); la conversión a nota de voz se hace recién si algún día se manda por
// WhatsApp, con prepararNotaVoz. Aquí no se envía nada.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const MAX_BYTES = 16 * 1024 * 1024;

export async function GET() {
  return NextResponse.json({ ok: true, audios: listAudiosMary() });
}

export async function POST(req: NextRequest) {
  const rl = limitar(req, "audios-mary", 60);
  if (rl) return rl;

  const form = await req.formData();
  const file = form.get("file");
  const titulo = String(form.get("titulo") ?? "").trim();
  const cuando = String(form.get("cuando_usarlo") ?? "").trim();
  const segundos = Math.max(0, Math.round(Number(form.get("segundos")) || 0));
  if (!(file instanceof Blob) || !titulo) {
    return NextResponse.json({ ok: false, error: "Falta el audio o el nombre" }, { status: 400 });
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
  const name = `mary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  } catch (e) {
    console.error("audios-mary:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el audio" }, { status: 500 });
  }

  const id = addAudioMary({ archivo: name, titulo, cuando_usarlo: cuando, segundos });
  return NextResponse.json({ ok: true, id, archivo: name, segundos });
}

export async function PATCH(req: NextRequest) {
  let b: { id?: number; titulo?: string; cuando_usarlo?: string };
  try {
    b = (await req.json()) as typeof b;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(b.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const ok = updateAudioMary(id, { titulo: b.titulo, cuando_usarlo: b.cuando_usarlo });
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}

/** Lo saca de la lista. El archivo se queda en disco: lo de Mary no se borra. */
export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const ok = deleteAudioMary(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
