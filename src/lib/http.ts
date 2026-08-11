import { NextResponse } from "next/server";
import { gzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

// Devuelve JSON comprimido con gzip cuando el navegador lo acepta.
//
// Por qué existe: Next comprime el HTML de las páginas, pero NO las respuestas de las rutas
// /api (medido el 11-08-2026 contra producción: `/api/conversations` llegaba con
// `content-encoding: null` y 207 KB en crudo). La lista de chats se pide al abrir la app y
// cada 10 s; en datos móviles eso era ~1 MB por minuto solo por mirar la lista. El mismo
// JSON gzipeado baja a ~20 KB, sin cambiar ni un dato de lo que se manda.
//
// La compresión es ASÍNCRONA (no gzipSync) para no bloquear el único hilo de Node mientras
// comprime: si se bloquea, el servidor deja de atender todo lo demás.
export async function jsonComprimido(req: Request, data: unknown, extraHeaders: Record<string, string> = {}) {
  const body = JSON.stringify(data);
  const acepta = req.headers.get("accept-encoding") ?? "";
  // Por debajo de ~1 KB comprimir cuesta más de lo que ahorra.
  if (!acepta.includes("gzip") || body.length < 1024) {
    return NextResponse.json(data as Record<string, unknown>, { headers: extraHeaders });
  }
  const buf = await gzipAsync(body);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Vary": "Accept-Encoding",
      ...extraHeaders,
    },
  });
}
