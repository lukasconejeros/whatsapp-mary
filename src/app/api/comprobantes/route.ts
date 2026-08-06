import { NextResponse } from "next/server";
import { listBorradoresPendientes } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lo que espera el visto bueno de Mary en Finanzas: cada foto que parecía un
// comprobante de transferencia, con su monto leído y de qué chat salió.
export async function GET() {
  return NextResponse.json({ ok: true, comprobantes: listBorradoresPendientes() });
}
