import { NextRequest, NextResponse } from "next/server";
import { addChatMensaje, listChatMensajes, addMovimiento } from "@/lib/db";
import { procesarMensaje } from "@/lib/asistente";
import { nowSantiago } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export async function GET() {
  const mensajes = listChatMensajes(50);
  return NextResponse.json({ ok: true, mensajes });
}

export async function POST(req: NextRequest) {
  let texto: string;
  let mes: string | undefined;
  let origen: string;

  try {
    const b = (await req.json()) as {
      texto?: string;
      mes?: string;
      origen?: string;
    };
    if (!b.texto || typeof b.texto !== "string" || !b.texto.trim()) {
      return NextResponse.json(
        { ok: false, error: "texto es requerido" },
        { status: 400 }
      );
    }
    texto = b.texto.trim();
    mes = typeof b.mes === "string" && b.mes.trim() ? b.mes.trim() : undefined;
    origen = b.origen === "audio" ? "audio" : "texto";
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

  // Guardar mensaje del usuario
  addChatMensaje("user", texto);

  let accion;
  try {
    accion = await procesarMensaje(texto, mes);
  } catch (e) {
    const msg = "Uy, no pude pensar la respuesta ahora. Intenta de nuevo en un ratito.";
    addChatMensaje("asistente", msg);
    return NextResponse.json({ ok: false, respuesta: msg, error: String(e) }, { status: 502 });
  }

  // Si la IA quiere registrar un movimiento, registrarlo
  let registrado = false;
  if (accion.accion === "registrar" && accion.monto && accion.monto > 0 && accion.tipo) {
    addMovimiento({
      fecha: nowSantiago(),
      tipo: accion.tipo,
      monto: accion.monto,
      categoria: accion.categoria,
      descripcion: accion.descripcion,
      origen,
    });
    registrado = true;
  }

  // Guardar respuesta del asistente
  addChatMensaje("asistente", accion.respuesta);

  return NextResponse.json({ ok: true, respuesta: accion.respuesta, registrado });
}
