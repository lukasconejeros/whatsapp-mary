import { NextResponse } from "next/server";
import fs from "fs/promises";
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
  // Lectura ASÍNCRONA a propósito: la versión con readFileSync bloqueaba el único hilo de
  // Node en cada foto, y al abrir el inbox llegan decenas seguidas → el servidor no atendía
  // nada más (ni el cambio de pantalla) mientras leía del disco.
  let data: Buffer;
  try {
    data = await fs.readFile(file);
  } catch {
    return NextResponse.json({ ok: false, error: "no encontrado" }, { status: 404 });
  }
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";
  // Fotos de perfil: el nombre es fijo por conversación (avatar_<id>.jpg), así que se
  // cachean un día — si algún día se actualiza la foto del contacto, se ve al día siguiente
  // en vez de quedarse pegada para siempre. Los audios/fotos de mensajes llevan marca de
  // tiempo en el nombre: nunca cambian, se cachean un año.
  const esAvatar = safe.startsWith("avatar_");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": TIPOS[ext] ?? "application/octet-stream",
      "Cache-Control": esAvatar
        ? "private, max-age=86400, stale-while-revalidate=604800"
        : "private, max-age=31536000, immutable",
    },
  });
}
