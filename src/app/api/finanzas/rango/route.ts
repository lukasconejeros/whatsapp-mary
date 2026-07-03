import { NextRequest, NextResponse } from "next/server";
import { listIngresosRange, listCostosRange } from "@/lib/db";

export const dynamic = "force-dynamic";

// Ingresos + costos en un rango de fechas (desde/hasta = YYYY-MM-DD, inclusive).
// Alimenta la pestaña Métricas.
export async function GET(req: NextRequest) {
  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json({ ok: false, error: "falta desde/hasta" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    ingresos: listIngresosRange(desde, hasta),
    costos: listCostosRange(desde, hasta),
  });
}
