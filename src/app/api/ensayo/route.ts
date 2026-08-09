import { NextRequest, NextResponse } from "next/server";
import {
  addEnsayoMensaje,
  listEnsayoMensajes,
  archivarEnsayo,
  marcarEnsayoMalo,
  type EnsayoMensaje,
} from "@/lib/db";
import { responderEnsayo, type TurnoEnsayo } from "@/lib/ensayo";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

function aTurnos(msgs: EnsayoMensaje[]): TurnoEnsayo[] {
  return msgs.map((m) => ({ rol: m.rol, texto: m.texto }));
}

export async function GET() {
  return NextResponse.json({ ok: true, mensajes: listEnsayoMensajes() });
}

export async function POST(req: NextRequest) {
  const rl = limitar(req, "ensayo");
  if (rl) return rl;

  let texto: string;
  try {
    const b = (await req.json()) as { texto?: string };
    texto = typeof b.texto === "string" ? b.texto.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  if (!texto) {
    return NextResponse.json({ ok: false, error: "texto es requerido" }, { status: 400 });
  }

  addEnsayoMensaje("apoderado", texto);

  try {
    const r = await responderEnsayo(aTurnos(listEnsayoMensajes()));
    // Si el bot se apaga (silenciar) no escribe nada: se guarda igual el turno con
    // sus avisos, porque a Mary le sirve ver que ahí NO habría contestado.
    const id = addEnsayoMensaje("bot", r.texto, r.acciones);
    return NextResponse.json({
      ok: true,
      id,
      texto: r.texto,
      acciones: r.acciones,
      demoraMs: r.demoraMs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

/**
 * Empezar de nuevo: deja la pantalla limpia SIN borrar la práctica — queda archivada
 * con su número de sesión. Son horas de trabajo de Mary: no se pierden con un botón.
 */
export async function DELETE() {
  const { archivados, sesion } = archivarEnsayo();
  return NextResponse.json({ ok: true, archivados, sesion });
}

/** "Esto yo no lo diría" — Mary marca una respuesta del bot. */
export async function PATCH(req: NextRequest) {
  let id: number;
  let malo: boolean;
  try {
    const b = (await req.json()) as { id?: number; malo?: boolean };
    id = Number(b.id);
    malo = b.malo !== false;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }
  const ok = marcarEnsayoMalo(id, malo);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
