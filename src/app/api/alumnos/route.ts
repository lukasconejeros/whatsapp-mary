import { NextRequest, NextResponse } from "next/server";
import { addAlumno } from "@/lib/db";
import { fichasDelMes } from "@/lib/crm-alumnos";
import { resumenDelMes } from "@/lib/mensualidades";

export const dynamic = "force-dynamic";

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** El mes de hoy en Chile, que es donde vive Mary (no el del servidor en UTC). */
function mesDeHoy(): string {
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });
  return hoy.slice(0, 7);
}

// Las fichas del CRM. Siempre con un mes a la vista: un contador de faltas sin su
// ventana de tiempo no dice nada (ya costó un diagnóstico equivocado en otro panel).
export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes") ?? mesDeHoy();
  if (!MES.test(mes)) {
    return NextResponse.json({ ok: false, error: "mes debe ser YYYY-MM" }, { status: 400 });
  }
  const alumnos = fichasDelMes(mes);
  return NextResponse.json({ ok: true, mes, alumnos, pagos: resumenDelMes(alumnos) });
}

export async function POST(req: NextRequest) {
  const b = await req.json() as {
    nombre?: string; apoderado?: string | null; telefono?: string | null;
    mensualidad?: number; notas?: string | null; revisar?: string | null;
  };
  const nombre = (b.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ ok: false, error: "el nombre es obligatorio" }, { status: 400 });
  }
  const id = addAlumno({
    nombre, apoderado: b.apoderado ?? null, telefono: b.telefono ?? null,
    mensualidad: b.mensualidad ?? 0, notas: b.notas ?? null, revisar: b.revisar ?? null,
  });
  return NextResponse.json({ ok: true, id });
}
