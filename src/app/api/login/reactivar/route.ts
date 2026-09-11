import { NextRequest, NextResponse } from "next/server";
import { reactivarConCodigo } from "@/lib/porteria-store";

export const dynamic = "force-dynamic";

/**
 * Reabre el panel con el código que llegó por WhatsApp, o con CODIGO_MAESTRO.
 *
 * El maestro existe porque el aviso viaja por WhatsApp y el bot se puede caer: sin esta puerta, un
 * bot desconectado + un panel cerrado = clínica sin panel y nadie con el código. Va en el entorno de
 * EasyPanel, así que cambiarlo no necesita tocar el código.
 *
 * Esta ruta también se limita: si no, sería la puerta de atrás para probar códigos de 6 cifras a lo
 * bruto (un millón de combinaciones se prueban en minutos si nadie frena).
 */
const intentos = new Map<string, { n: number; hasta: number }>();
const MAX_POR_HORA = 10;

function quien(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : req.headers.get("x-real-ip")?.trim() || "local";
}

export async function POST(req: NextRequest) {
  const ip = quien(req);
  const ahora = Date.now();
  const f = intentos.get(ip);
  if (f && f.hasta > ahora && f.n >= MAX_POR_HORA) {
    return NextResponse.json(
      { ok: false, error: "Demasiados códigos probados. Espera una hora." },
      { status: 429 },
    );
  }

  let codigo = "";
  try {
    const body = await req.json();
    codigo = typeof body?.codigo === "string" ? body.codigo : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const limpio = codigo.replace(/\D/g, "");
  const maestro = (process.env.CODIGO_MAESTRO ?? "").replace(/\D/g, "");
  const esMaestro = maestro.length >= 6 && limpio === maestro;

  if (esMaestro || reactivarConCodigo(limpio)) {
    intentos.delete(ip);
    return NextResponse.json({ ok: true });
  }

  const previo = f && f.hasta > ahora ? f.n : 0;
  intentos.set(ip, { n: previo + 1, hasta: ahora + 3_600_000 });
  return NextResponse.json({ ok: false, error: "Ese código no es válido." }, { status: 401 });
}
