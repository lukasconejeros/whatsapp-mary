import { NextResponse } from "next/server";
import { listBorradoresPendientes, listAlumnos } from "@/lib/db";
import { propuestaDeComprobante } from "@/lib/crm-alumnos";

export const dynamic = "force-dynamic";

// Lo que espera el visto bueno de Mary en Finanzas: cada foto que parecía un
// comprobante de transferencia, con su monto leído, de qué chat salió y —desde el
// enganche del paso 4— DE QUIÉN se propone que es el pago.
//
// La lista de alumnos va aparte y una sola vez: es para el desplegable, por si el
// pago era de otro y Mary tiene que cambiarlo a mano.
export async function GET() {
  const comprobantes = listBorradoresPendientes().map((c) => ({
    ...c,
    propuesta: propuestaDeComprobante(c.id),
  }));
  const alumnos = listAlumnos()
    .filter((a) => a.activo)
    .map((a) => ({ id: a.id, nombre: a.nombre, mensualidad: a.mensualidad }))
    .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
  return NextResponse.json({ ok: true, comprobantes, alumnos });
}
