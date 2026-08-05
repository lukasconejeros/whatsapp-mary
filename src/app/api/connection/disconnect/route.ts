import { NextResponse } from "next/server";
import path from "path";
import { setConnectionState } from "@/lib/db";
import { vaciarAuth, pedirReinicioQR } from "@/lib/reinicio-qr";

export const dynamic = "force-dynamic";

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const DATA_DIR = path.resolve(process.cwd(), "data");

export async function POST() {
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });
  // Se vacía el CONTENIDO de auth/, nunca la carpeta: en producción es un volumen
  // montado y borrarla lanza EBUSY, lo que dejaba la señal de abajo sin escribir y el
  // botón sin efecto. Ver src/lib/reinicio-qr.ts.
  const limpieza = vaciarAuth(AUTH_DIR);
  pedirReinicioQR(DATA_DIR);
  return NextResponse.json({ ok: true, ...limpieza });
}
