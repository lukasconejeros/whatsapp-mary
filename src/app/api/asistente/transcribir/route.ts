import { NextRequest, NextResponse } from "next/server";
import { transcribirAudio } from "@/lib/asistente";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "falta el archivo" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const texto = await transcribirAudio(buffer, "audio.webm");
    return NextResponse.json({ ok: true, texto });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
