import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Clave pública VAPID para que el navegador se suscriba. Vacía si no está configurada.
export async function GET() {
  // Diagnóstico temporal: nombres de variables VAPID que ve el proceso (sin valores
  // secretos) para cazar typos de nombre. Se puede quitar luego.
  const vars = Object.keys(process.env).filter((k) => /vapid/i.test(k)).sort();
  return NextResponse.json({
    ok: true,
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    debug: { vars, subject: process.env.VAPID_SUBJECT ?? null },
  });
}
