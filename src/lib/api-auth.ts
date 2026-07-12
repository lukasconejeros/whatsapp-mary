import { NextRequest } from "next/server";
import { COOKIE_SESION, esSesionValida } from "./auth";

// Autoriza los endpoints "máquina" (movimientos/contexto), que están fuera del
// candado de sesión del middleware. Acepta DOS pruebas:
//   1) la SESIÓN del panel (cookie de Mary) — para la app (ej. pestaña Caja),
//   2) una x-api-key válida — para integraciones externas (n8n/Telegram).
// FAIL-CLOSED: si no hay ninguna prueba válida (o la clave no está configurada),
// rechaza. Nunca queda abierto por falta de configuración.
export async function autorizadoMaquina(req: NextRequest): Promise<boolean> {
  if (await esSesionValida(req.cookies.get(COOKIE_SESION)?.value)) return true;
  const key = process.env.MOVIMIENTOS_API_KEY;
  if (key && key.trim() && req.headers.get("x-api-key") === key) return true;
  return false;
}
