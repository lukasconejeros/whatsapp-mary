import { NextRequest, NextResponse } from "next/server";
import { addChatMensaje, listChatMensajes, addIngreso, addCosto } from "@/lib/db";
import { procesarMensaje } from "@/lib/asistente";
import { nowSantiago } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export async function GET() {
  const mensajes = listChatMensajes(50);
  return NextResponse.json({ ok: true, mensajes });
}

export async function POST(req: NextRequest) {
  let texto: string;

  try {
    const b = (await req.json()) as { texto?: string; origen?: string };
    if (!b.texto || typeof b.texto !== "string" || !b.texto.trim()) {
      return NextResponse.json(
        { ok: false, error: "texto es requerido" },
        { status: 400 }
      );
    }
    texto = b.texto.trim();
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
    accion = await procesarMensaje(texto);
  } catch (e) {
    const msg = "Uy, no pude pensar la respuesta ahora. Intenta de nuevo en un ratito.";
    addChatMensaje("asistente", msg);
    return NextResponse.json({ ok: false, respuesta: msg, error: String(e) }, { status: 502 });
  }

  // Si la IA quiere registrar, va al MISMO lugar que los botones (ingresos/costos),
  // así aparece en Ganancias/Costos y en Métricas. (origen 'texto'|'audio' ya no
  // se usa como columna, pero se mantiene por compatibilidad del contrato.)
  let registrado = false;
  if (accion.accion === "registrar" && accion.monto && accion.monto > 0 && accion.tipo) {
    const fecha = nowSantiago().slice(0, 10); // YYYY-MM-DD, como el botón "Agregar"
    if (accion.tipo === "ingreso") {
      addIngreso({ fecha, monto: accion.monto, tipo: accion.categoria, detalle: accion.descripcion });
    } else {
      addCosto({ fecha, valor: accion.monto, tipo: accion.categoria, notas: accion.descripcion });
    }
    registrado = true;
  }

  // Guardar respuesta del asistente
  addChatMensaje("asistente", accion.respuesta);

  return NextResponse.json({ ok: true, respuesta: accion.respuesta, registrado });
}
