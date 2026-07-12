import { NextRequest, NextResponse } from "next/server";
import { parsearCartola, importarCartola } from "@/lib/cartola";

export const dynamic = "force-dynamic";

// Importa una cartola de MercadoPago pegada: abonos → INGRESOS (agrupados por tipo),
// pagos → GASTOS, comisión de MercadoPago → GASTO aparte, transferencias enviadas
// (retiros) omitidas. NO duplica (dedup por ID de transacción).
export async function POST(req: NextRequest) {
  let body: { texto?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  const texto = (body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ ok: false, error: "Pega el contenido de la cartola" }, { status: 400 });

  if (parsearCartola(texto).movimientos.length === 0) {
    return NextResponse.json({ ok: false, error: "No reconocí movimientos en ese texto. Copia la tabla de la cartola de MercadoPago." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...importarCartola(texto) });
}
