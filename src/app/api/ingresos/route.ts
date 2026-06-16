import { NextRequest, NextResponse } from "next/server";
import { addIngreso } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json() as { fecha?: string; apoderado?: string; monto?: number; tipo?: string; detalle?: string };
  if (!b.fecha || typeof b.monto !== "number") {
    return NextResponse.json({ ok: false, error: "fecha y monto son obligatorios" }, { status: 400 });
  }
  const id = addIngreso({ fecha: b.fecha, apoderado: b.apoderado, monto: b.monto, tipo: b.tipo, detalle: b.detalle });
  return NextResponse.json({ ok: true, id });
}
