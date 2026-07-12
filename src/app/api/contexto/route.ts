import { NextRequest, NextResponse } from "next/server";
import { listMovimientos, listIngresos, listCostos, listClases, listClientes } from "@/lib/db";
import { monthSantiago } from "@/lib/fechas";
import { autorizadoMaquina } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Contexto que usa el asistente de Telegram para responder preguntas sobre finanzas
// y calendario. Devuelve datos personales de apoderados → FAIL-CLOSED (sesión o clave).
export async function GET(req: NextRequest) {
  if (!(await autorizadoMaquina(req))) {
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
