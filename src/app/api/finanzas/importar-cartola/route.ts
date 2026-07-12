import { NextRequest, NextResponse } from "next/server";
import { parsearCartola } from "@/lib/cartola";
import { importarIngresoCartola, importarCostoCartola } from "@/lib/db";

export const dynamic = "force-dynamic";

// Importa una cartola de MercadoPago pegada: agrega los abonos como INGRESOS y los
// pagos como GASTOS, omite las transferencias enviadas (retiros), y NO duplica
// (dedup por ID de transacción de MercadoPago).
export async function POST(req: NextRequest) {
  let body: { texto?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  const texto = (body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ ok: false, error: "Pega el contenido de la cartola" }, { status: 400 });

  const r = parsearCartola(texto);
  if (r.movimientos.length === 0) {
    return NextResponse.json({ ok: false, error: "No reconocí movimientos en ese texto. Copia la tabla de la cartola de MercadoPago." }, { status: 400 });
  }

  let ingresosNuevos = 0, costosNuevos = 0, duplicados = 0;
  for (const m of r.movimientos) {
    if (m.clasificacion === "omitido") continue;
    if (m.clasificacion === "ingreso") {
      if (importarIngresoCartola({ fecha: m.fecha, monto: m.monto, detalle: `MercadoPago · ${m.tipoTrans}`, mpId: m.mpId })) ingresosNuevos++;
      else duplicados++;
    } else {
      if (importarCostoCartola({ fecha: m.fecha, valor: m.monto, notas: `MercadoPago · ${m.tipoTrans}`, mpId: m.mpId })) costosNuevos++;
      else duplicados++;
    }
  }

  return NextResponse.json({
    ok: true,
    ingresosNuevos,
    costosNuevos,
    duplicados,
    omitidos: r.omitidos,
    totalIngresos: r.totalIngresos,
    totalCostos: r.totalCostos,
  });
}
