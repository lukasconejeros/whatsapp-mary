import { NextRequest, NextResponse } from "next/server";
import { addCosto } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await req.json() as { fecha?: string; tipo?: string; cantidad?: number; valor?: number; notas?: string };
  if (!b.fecha || typeof b.valor !== "number") {
    return NextResponse.json({ ok: false, error: "fecha y valor son obligatorios" }, { status: 400 });
  }
  const id = addCosto({ fecha: b.fecha, tipo: b.tipo, cantidad: b.cantidad, valor: b.valor, notas: b.notas });
  return NextResponse.json({ ok: true, id });
}
