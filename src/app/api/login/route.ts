import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, tokenEsperado } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  const pw = typeof body.password === "string" ? body.password : "";
  const real = process.env.PANEL_PASSWORD;
  if (!real) {
    return NextResponse.json({ ok: false, error: "Falta configurar la contraseña del panel." }, { status: 500 });
  }
  if (pw !== real) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" }, { status: 401 });
  }
  const token = await tokenEsperado();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESION, token!, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}
