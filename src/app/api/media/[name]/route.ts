import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const TIPOS: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  ogg: "audio/ogg", opus: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", "3gp": "video/3gpp",
};

interface RouteContext { params: Promise<{ name: string }> }

// Sirve un archivo de foto/audio guardado (data/media/<name>). Protegido por el
// middleware de login del panel, como el resto de la app.
export async function GET(_req: Request, ctx: RouteContext) {
  const { name } = await ctx.params;
  // Anti path-traversal: solo el nombre base, nada de "/" ni "..".
  const safe = path.basename(name);
  if (safe !== name || name.includes("..")) {
    return NextResponse.json({ ok: false, error: "nombre invalido" }, { status: 400 });
  }
  const file = path.join(MEDIA_DIR, safe);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ ok: false, error: "no encontrado" }, { status: 404 });
  }
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";
  const data = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": TIPOS[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000",
    },
  });
}
