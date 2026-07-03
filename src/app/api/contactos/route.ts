import { NextRequest, NextResponse } from "next/server";
import { listContactos, setClienteEstado } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lista todos los contactos (clientes) con sus campos y estado (activo/inactivo).
export async function GET() {
  return NextResponse.json({ ok: true, contactos: listContactos() });
}

// Cambia la etiqueta de un contacto: { telefono, estado: 'activo' | 'inactivo' }
export async function PATCH(req: NextRequest) {
  let body: { telefono?: string; estado?: string };
  try {
    body = (await req.json()) as { telefono?: string; estado?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const telefono = (body.telefono ?? "").trim();
  const estado = (body.estado ?? "").trim();
  if (!telefono || (estado !== "activo" && estado !== "inactivo")) {
    return NextResponse.json({ ok: false, error: "Faltan datos (telefono, estado activo|inactivo)" }, { status: 400 });
  }
  const ok = setClienteEstado(telefono, estado);
  if (!ok) return NextResponse.json({ ok: false, error: "Contacto no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
