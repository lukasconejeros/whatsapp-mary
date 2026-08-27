import { NextRequest, NextResponse } from "next/server";
import {
  getBorradorComprobante, aprobarBorradorComprobante, descartarBorradorComprobante,
} from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

interface Body {
  accion?: "aprobar" | "descartar";
  monto?: number; fecha?: string; apoderado?: string; tipo?: string; detalle?: string;
  /** El enganche del paso 4: a qué alumno (o hermanos) es este pago, y de qué mes. */
  alumnoIds?: unknown; mes?: unknown;
}

// Los dos botones de la bandeja. El ingreso nace SOLO al aprobar, con lo que Mary
// haya corregido en pantalla (monto, fecha, categoría), nunca solo.
export async function POST(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });

  const b = await req.json().catch(() => ({})) as Body;
  if (b.accion !== "aprobar" && b.accion !== "descartar") {
    return NextResponse.json({ ok: false, error: "accion debe ser aprobar o descartar" }, { status: 400 });
  }
  if (!getBorradorComprobante(id)) {
    return NextResponse.json({ ok: false, error: "ese comprobante ya no está" }, { status: 404 });
  }

  if (b.accion === "descartar") {
    descartarBorradorComprobante(id);
    return NextResponse.json({ ok: true });
  }

  // Un monto corregido a mano solo se acepta si es un número usable; si viene
  // basura, se queda el que leyó el modelo en vez de guardar un ingreso en cero.
  const monto = typeof b.monto === "number" && b.monto > 0 ? Math.round(b.monto) : undefined;

  // El enganche con el CRM. Aquí NO vale "ante la duda, lo más probable": un id o un
  // mes que no se entienden se rechazan, porque marcar el mes del alumno equivocado
  // le inventa una deuda a una familia y le regala un pago a otra.
  let alumnoIds: number[] | undefined;
  if (b.alumnoIds !== undefined) {
    if (!Array.isArray(b.alumnoIds) || !b.alumnoIds.every((x) => Number.isInteger(x) && (x as number) > 0)) {
      return NextResponse.json({ ok: false, error: "alumnoIds debe ser una lista de ids" }, { status: 400 });
    }
    alumnoIds = (b.alumnoIds as number[]).length > 0 ? (b.alumnoIds as number[]) : undefined;
  }
  let mes: string | undefined;
  if (b.mes !== undefined && b.mes !== null && b.mes !== "") {
    if (typeof b.mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.mes)) {
      return NextResponse.json({ ok: false, error: "mes debe ser YYYY-MM" }, { status: 400 });
    }
    mes = b.mes;
  }

  const ingresoId = aprobarBorradorComprobante(id, {
    monto, fecha: b.fecha, apoderado: b.apoderado, tipo: b.tipo, detalle: b.detalle,
    alumnoIds, mes,
  });
  if (ingresoId === null) {
    return NextResponse.json({ ok: false, error: "ese comprobante ya fue descartado" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, ingresoId });
}
