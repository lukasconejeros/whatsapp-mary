import { NextRequest, NextResponse } from "next/server";
import { listPagosFijos, addPagoFijo, type TipoPagoFijo } from "@/lib/db";

export const dynamic = "force-dynamic";

// Los pagos que vuelven cada mes. Devuelve TODOS (activos y dados de baja): el
// calendario filtra, pero la pantalla de administración los necesita completos.
export async function GET() {
  return NextResponse.json({ ok: true, pagosFijos: listPagosFijos() });
}

export async function POST(req: NextRequest) {
  const b = await req.json() as {
    tipo?: string; descripcion?: string; monto?: number; diaMes?: number; activo?: boolean;
  };
  if (!b.tipo || !b.diaMes) {
    return NextResponse.json({ ok: false, error: "tipo y día del mes son obligatorios" }, { status: 400 });
  }
  try {
    const id = addPagoFijo({
      tipo: b.tipo as TipoPagoFijo, descripcion: b.descripcion,
      monto: b.monto ?? 0, diaMes: b.diaMes, activo: b.activo,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    // "Otros" sin descripción cae aquí: el mensaje es el que ve Mary en pantalla.
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
