import { NextRequest, NextResponse } from "next/server";
import { listRecordatorios, addRecordatorio } from "@/lib/db";

export const dynamic = "force-dynamic";

// Los recordatorios de Mary. Van por WhatsApp A SU teléfono, nunca al apoderado.
// Se piden por rango porque el calendario pinta el mes entero de una.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json({ ok: false, error: "faltan desde y hasta" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, recordatorios: listRecordatorios(desde, hasta) });
}

export async function POST(req: NextRequest) {
  const b = await req.json() as {
    fecha?: string; hora?: string; texto?: string; avisar?: boolean;
  };
  if (!b.fecha || !b.texto?.trim()) {
    return NextResponse.json({ ok: false, error: "fecha y descripción son obligatorias" }, { status: 400 });
  }
  const id = addRecordatorio({ fecha: b.fecha, hora: b.hora, texto: b.texto, avisar: b.avisar });
  return NextResponse.json({ ok: true, id });
}
