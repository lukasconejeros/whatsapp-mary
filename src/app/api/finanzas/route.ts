import { NextRequest, NextResponse } from "next/server";
import { listIngresos, listCostos } from "@/lib/db";
import { currentMonth } from "@/lib/finanzas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ ok: false, error: "mes inválido (YYYY-MM)" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ingresos: listIngresos(mes), costos: listCostos(mes) });
}
