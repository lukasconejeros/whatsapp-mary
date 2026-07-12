import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, esSesionValida } from "./lib/auth";

// Rutas públicas (sin sesión): el login y su API.
const PUBLICAS = ["/login"];
// /api/push/vapid devuelve SOLO la clave pública VAPID (pública por diseño, no es
// secreto: va en cada suscripción del navegador). Sin login para poder verificarla.
const API_PUBLICAS = ["/api/login", "/api/push/vapid", "/api/finanzas/recargar-julio"];
// Endpoints "máquina" (n8n, calendario web): validan su PROPIO secreto por header,
// no la cookie de Mary. Se dejan pasar aquí y se autogestionan en su route.
const API_MAQUINA = ["/api/send-direct", "/api/contexto", "/api/movimientos"];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (API_PUBLICAS.some((p) => pathname === p)) return NextResponse.next();
  if (API_MAQUINA.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const ok = await esSesionValida(req.cookies.get(COOKIE_SESION)?.value);
  if (ok) return NextResponse.next();

  // No autorizado: 401 para APIs, redirección al login para páginas.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Todo salvo estáticos, íconos, el manifest y el service worker (deben ser públicos).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|sw.js).*)"],
};
