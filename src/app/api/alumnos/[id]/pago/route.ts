import { NextRequest, NextResponse } from "next/server";
import { getAlumno, marcarPago, quitarPago, getMensualidad } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// El pago de la mensualidad de UN alumno en UN mes. Siempre con el mes por delante:
// marcar un pago sin decir de qué mes es lo mismo que no marcarlo.
export async function POST(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const alumno = getAlumno(id);
  if (!alumno) return NextResponse.json({ ok: false, error: "ese alumno no existe" }, { status: 404 });

  const b = await req.json().catch(() => ({})) as {
    mes?: string; pagado?: number; monto?: number; fecha?: string | null; nota?: string | null;
  };
  if (!b.mes || !MES.test(b.mes)) {
    return NextResponse.json({ ok: false, error: "mes debe ser YYYY-MM" }, { status: 400 });
  }
  if (b.fecha && !FECHA.test(b.fecha)) {
    return NextResponse.json({ ok: false, error: "fecha debe ser YYYY-MM-DD" }, { status: 400 });
  }
  // Sin monto en el cuerpo se entiende "pagó lo suyo": su plan del mes. Así el botón
  // de la tarjeta es un solo toque y no obliga a Mary a escribir la cifra.
  const pagado = typeof b.pagado === "number" && b.pagado >= 0
    ? Math.round(b.pagado)
    : (getMensualidad(id, b.mes)?.monto ?? alumno.mensualidad);
  if (!(pagado > 0)) {
    return NextResponse.json(
      { ok: false, error: "este alumno todavía no tiene mensualidad cargada" },
      { status: 400 }
    );
  }

  marcarPago({
    alumnoId: id, mes: b.mes, pagado,
    monto: typeof b.monto === "number" && b.monto >= 0 ? Math.round(b.monto) : undefined,
    fecha: b.fecha ?? null,
    nota: b.nota ?? null,
  });
  return NextResponse.json({ ok: true, pago: getMensualidad(id, b.mes) });
}

// Deshacer: Mary marcó al que no era. No deja rastro, la fila se va.
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const mes = req.nextUrl.searchParams.get("mes") ?? "";
  if (!MES.test(mes)) {
    return NextResponse.json({ ok: false, error: "mes debe ser YYYY-MM" }, { status: 400 });
  }
  quitarPago(id, mes);
  return NextResponse.json({ ok: true });
}
