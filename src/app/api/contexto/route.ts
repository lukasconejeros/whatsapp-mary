import { NextRequest, NextResponse } from "next/server";
import { listMovimientos, listIngresos, listCostos, listClases, listClientes } from "@/lib/db";
import { monthSantiago } from "@/lib/fechas";

export const dynamic = "force-dynamic";

// Contexto que usa el asistente de Telegram para responder preguntas
// sobre finanzas y calendario. Protegido con el mismo token de movimientos.
export async function GET(req: NextRequest) {
  const key = process.env.MOVIMIENTOS_API_KEY;
  if (key && key.trim() && req.headers.get("x-api-key") !== key) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }
  const mes = req.nextUrl.searchParams.get("mes") || monthSantiago();
  return NextResponse.json({
    ok: true,
    mes,
    movimientos: listMovimientos({ mes }),
    ingresos: listIngresos(mes),
    costos: listCostos(mes),
    clases: listClases(),
    clientes: listClientes().map((c) => ({ nombre: c.nombre, telefono: c.telefono, horario: c.horario })),
  });
}
