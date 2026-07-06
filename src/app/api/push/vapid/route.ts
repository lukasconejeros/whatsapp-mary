import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Clave pública VAPID para que el navegador se suscriba. Vacía si no está configurada.
export async function GET() {
  return NextResponse.json({ ok: true, publicKey: process.env.VAPID_PUBLIC_KEY ?? "" });
}
