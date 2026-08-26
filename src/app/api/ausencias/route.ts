import { NextRequest, NextResponse } from "next/server";
import { ausenciasRango, avisarAusencia, getAlumno } from "@/lib/db";

export const dynamic = "force-dynamic";

// El botón "no viene" del calendario (Lukas, 26-08-2026).
//
// Ojo: esto NO es la asistencia. Aquí va lo que Mary sabe ANTES de la clase —"no
// viene el martes" o "no viene en todo septiembre"—; en /api/asistencia va lo que
// pasó de verdad. Por eso quien tiene un aviso queda fuera del pase de lista de las
// 21:00 y sale en gris, no en rojo.

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (!desde || !hasta || !FECHA.test(desde) || !FECHA.test(hasta)) {
    return NextResponse.json({ ok: false, error: "faltan desde y hasta (YYYY-MM-DD)" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ausencias: ausenciasRango(desde, hasta) });
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as {
    alumnoId?: number; tipo?: string; fecha?: string; mes?: string; motivo?: string | null;
  };
  if (!b.alumnoId || !getAlumno(b.alumnoId)) {
    return NextResponse.json({ ok: false, error: "ese alumno no existe" }, { status: 400 });
  }
  if (b.tipo !== "dia" && b.tipo !== "mes") {
    return NextResponse.json({ ok: false, error: "tipo debe ser dia o mes" }, { status: 400 });
  }
  if (b.tipo === "dia" && !FECHA.test(b.fecha ?? "")) {
    return NextResponse.json({ ok: false, error: "para un día falta la fecha (YYYY-MM-DD)" }, { status: 400 });
  }
  if (b.tipo === "mes" && !MES.test(b.mes ?? "")) {
    return NextResponse.json({ ok: false, error: "para un mes falta el mes (YYYY-MM)" }, { status: 400 });
  }
  const id = avisarAusencia({
    alumnoId: b.alumnoId, tipo: b.tipo,
    fecha: b.fecha ?? null, mes: b.mes ?? null,
    motivo: b.motivo?.trim() || null,
  });
  return NextResponse.json({ ok: true, id });
}
