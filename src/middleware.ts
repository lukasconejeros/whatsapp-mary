import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, esSesionValida } from "./lib/auth";

// Rutas públicas (sin sesión): el login y su API.
// `/f` es el formulario que se le manda a la gente por WhatsApp: si pidiera login no
// lo podría abrir nadie. Solo enseña el formulario que Mary marcó como abierto, y
// nunca devuelve teléfonos ni datos de la base (ver src/app/api/f/[slug]/route.ts).
const PUBLICAS = ["/login", "/f"];
// /api/push/vapid devuelve SOLO la clave pública VAPID (pública por diseño, no es
// secreto: va en cada suscripción del navegador). Sin login para poder verificarla.
// `/api/f/...` es la que lee y recibe ese formulario. Va con rate-limit propio y
// revalida TODO en el servidor: el HTML no es la puerta, esta ruta sí.
const API_PUBLICAS = ["/api/login", "/api/push/vapid"];
const API_PUBLICAS_PREFIJO = ["/api/f/"];
// Endpoints "máquina" (n8n, calendario web): validan su PROPIO secreto por header,
// no la cookie de Mary. Se dejan pasar aquí y se autogestionan en su route.
const API_MAQUINA = ["/api/send-direct", "/api/contexto", "/api/movimientos", "/api/diag-envio"];

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (API_PUBLICAS.some((p) => pathname === p)) return NextResponse.next();
  if (API_PUBLICAS_PREFIJO.some((p) => pathname.startsWith(p))) return NextResponse.next();
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
