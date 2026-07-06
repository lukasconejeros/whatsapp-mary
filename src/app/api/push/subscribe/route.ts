import { NextRequest, NextResponse } from "next/server";
import { addPushSub } from "@/lib/db";

export const dynamic = "force-dynamic";

// Guarda la suscripción Web Push del navegador de Mary (protegido por el login).
export async function POST(req: NextRequest) {
  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = body.keys?.p256dh ?? "";
  const auth = body.keys?.auth ?? "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "Suscripción incompleta" }, { status: 400 });
  }
  addPushSub({ endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}
