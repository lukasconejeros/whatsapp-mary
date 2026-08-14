import { NextResponse } from "next/server";
import { getGastoIA } from "@/lib/db";
import { todaySantiago, monthSantiago } from "@/lib/fechas";

export const dynamic = "force-dynamic";

// Cuánto gasta el bot en IA (13-08-2026), igual que Medifis, Anpalex y Conejeros.
// Lo lee el futuro dashboard consolidado de gasto de los 4 bots.
export async function GET() {
  return NextResponse.json({ ok: true, gasto_ia: getGastoIA(todaySantiago(), monthSantiago()) });
}
