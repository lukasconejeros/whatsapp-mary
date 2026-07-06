// Sesión sin dependencias ni estado en servidor: la cookie es un token derivado de
// la contraseña del panel (PANEL_PASSWORD). Sólo quien conoce la contraseña (vía el
// login) obtiene el token correcto; un atacante no puede fabricarlo. Usa Web Crypto
// para funcionar tanto en el middleware (Edge) como en las rutas (Node).

const SALT = "arteluk-session-v1";
export const COOKIE_SESION = "sesion";

// Token esperado de la cookie. null si no hay PANEL_PASSWORD configurada
// (en ese caso NADIE pasa: la app queda cerrada hasta configurarla).
export async function tokenEsperado(): Promise<string | null> {
  const pw = process.env.PANEL_PASSWORD;
  if (!pw) return null;
  const data = new Uint8Array(new TextEncoder().encode(`${SALT}:${pw}`));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function esSesionValida(cookieValor: string | undefined): Promise<boolean> {
  if (!cookieValor) return false;
  const esperado = await tokenEsperado();
  return !!esperado && cookieValor === esperado;
}
