import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, tokenEsperado } from "@/lib/auth";
import { anotarFallo, veredicto, textoVeredicto, sortearCodigo, MEMORIA_MIN } from "@/lib/porteria";
import { leerFicha, guardarFicha, borrarFicha, cuantasCerradas, barrerCaducadas } from "@/lib/porteria-store";
import { avisarCierre } from "@/lib/porteria-aviso";

export const dynamic = "force-dynamic";

/**
 * De quién viene el intento. El panel corre detrás del proxy de EasyPanel, así que la dirección real
 * llega en `x-forwarded-for` (la primera de la lista); `req` a secas siempre vería la del proxy, y
 * castigar ahí dejaría a Mary y a las profes fuera por culpa de un solo atacante.
 */
function quienIntenta(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export async function POST(req: NextRequest) {
  const quien = quienIntenta(req);
  const ahora = Date.now();

  // Se barre al entrar (no con un temporizador de fondo): la tabla se mantiene chica sola. Solo borra
  // fichas SIN cerrar; los cierres se quedan hasta que alguien meta el código.
  barrerCaducadas(ahora - MEMORIA_MIN * 60_000);

  // Antes de mirar la contraseña: ¿este viene probando a lo bruto?
  const puerta = veredicto(leerFicha(quien), ahora);
  if (puerta.paso !== "adelante") {
    const esperaSeg = puerta.paso === "espera" ? Math.ceil(puerta.restanteMs / 1000) : 3600;
    return NextResponse.json(
      { ok: false, error: textoVeredicto(puerta), bloqueado: puerta.paso === "cerrada" },
      { status: 429, headers: { "Retry-After": String(esperaSeg) } },
    );
  }

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
    const { ficha, seCierraAhora } = anotarFallo(leerFicha(quien), ahora, sortearCodigo);
    guardarFicha(quien, ficha);

    if (seCierraAhora && ficha.codigo) {
      // El aviso se encola; lo despacha el bot. Si el bot está desconectado, el aviso espera en la
      // cola — por eso existe CODIGO_MAESTRO, que no depende de WhatsApp.
      avisarCierre({ quien, codigo: ficha.codigo, cerradasEnTotal: cuantasCerradas(), panel: "Arteluk" });
    }

    const tras = veredicto(ficha, ahora);
    if (tras.paso !== "adelante") {
      const esperaSeg = tras.paso === "espera" ? Math.ceil(tras.restanteMs / 1000) : 3600;
      return NextResponse.json(
        { ok: false, error: textoVeredicto(tras), bloqueado: tras.paso === "cerrada" },
        { status: 429, headers: { "Retry-After": String(esperaSeg) } },
      );
    }

    const quedan = tras.intentosRestantes;
    return NextResponse.json(
      { ok: false, error: `Contraseña incorrecta. Te queda${quedan === 1 ? "" : "n"} ${quedan} intento${quedan === 1 ? "" : "s"}.` },
      { status: 401 },
    );
  }

  borrarFicha(quien); // entró bien: se le borra el historial de fallos
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
