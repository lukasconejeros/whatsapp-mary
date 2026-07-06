import { NextRequest, NextResponse } from "next/server";
import { transcribirAudio } from "@/lib/asistente";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export async function POST(req: NextRequest) {
  const rl = limitar(req, "transcribir"); if (rl) return rl;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "falta el archivo" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "archivo inválido" }, { status: 400 });
  }
  try {
    const texto = await transcribirAudio(buffer, "audio.webm");
    return NextResponse.json({ ok: true, texto });
  } catch (e) {
    console.error("transcribir:", e);
    return NextResponse.json({ ok: false, error: "No se pudo transcribir" }, { status: 502 });
  }
}
