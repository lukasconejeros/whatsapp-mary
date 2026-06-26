import { NextRequest, NextResponse } from "next/server";
import { transcribirAudio } from "@/lib/asistente";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Se esperaba multipart/form-data" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo parsear el formulario" },
      { status: 400 }
    );
  }

  const file = formData.get("audio");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { ok: false, error: "Campo 'audio' requerido (Blob/File)" },
      { status: 400 }
    );
  }

  const filename =
    file instanceof File ? file.name : "audio.webm";

  let texto: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    texto = await transcribirAudio(buffer, filename);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true, texto });
}
