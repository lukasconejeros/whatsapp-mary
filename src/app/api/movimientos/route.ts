import { NextRequest, NextResponse } from "next/server";
import { addMovimiento, listMovimientos } from "@/lib/db";
import { nowSantiago, monthSantiago } from "@/lib/fechas";
import { autorizadoMaquina } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await autorizadoMaquina(req))) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }
  const b = await req.json() as {
    fecha?: string; tipo?: string; monto?: number;
    categoria?: string; descripcion?: string; origen?: string; chat_id?: string;
  };
  if (b.tipo !== "gasto" && b.tipo !== "ingreso") {
    return NextResponse.json({ ok: false, error: "tipo debe ser gasto|ingreso" }, { status: 400 });
  }
  if (typeof b.monto !== "number" || Number.isNaN(b.monto)) {
    return NextResponse.json({ ok: false, error: "monto debe ser numérico" }, { status: 400 });
  }
  const fecha = typeof b.fecha === "string" && b.fecha.trim() ? b.fecha.trim() : nowSantiago();
  const id = addMovimiento({
    fecha, tipo: b.tipo, monto: b.monto,
    categoria: b.categoria, descripcion: b.descripcion, origen: b.origen, chat_id: b.chat_id,
  });
  return NextResponse.json({ ok: true, id });
}

export async function GET(req: NextRequest) {
  if (!(await autorizadoMaquina(req))) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }
  const mes = req.nextUrl.searchParams.get("mes") || monthSantiago();
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ ok: false, error: "mes inválido (YYYY-MM)" }, { status: 400 });
  }
  const categoria = req.nextUrl.searchParams.get("categoria") || undefined;
  return NextResponse.json({ ok: true, movimientos: listMovimientos({ mes, categoria }) });
}
