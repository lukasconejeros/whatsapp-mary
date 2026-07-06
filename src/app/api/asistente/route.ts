import { NextRequest, NextResponse } from "next/server";
import { addChatMensaje, listChatMensajes, addIngreso, addCosto, addClase } from "@/lib/db";
import { procesarMensaje } from "@/lib/asistente";
import { prepararEnvio, ejecutarEnvio } from "@/lib/feedback";
import { nowSantiago } from "@/lib/fechas";
import { diaFromFecha } from "@/lib/calendario";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const mensajes = listChatMensajes(50);
  return NextResponse.json({ ok: true, mensajes });
}

export async function POST(req: NextRequest) {
  const rl = limitar(req, "asistente"); if (rl) return rl;
  let texto: string;
  let fotos: string[] = [];

  try {
    const b = (await req.json()) as { texto?: string; origen?: string; fotos?: string[] };
    fotos = Array.isArray(b.fotos) ? b.fotos.filter((f) => typeof f === "string") : [];
    const t = typeof b.texto === "string" ? b.texto.trim() : "";
    // Permitir mensaje solo-fotos (sin texto): la IA preguntará a quién se lo mando.
    if (!t && fotos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "texto es requerido" },
        { status: 400 }
      );
    }
    texto = t || "(te envío unas fotos)";
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
    accion = await procesarMensaje(texto, { fotos: fotos.length });
  } catch (e) {
    const msg = "Uy, no pude pensar la respuesta ahora. Intenta de nuevo en un ratito.";
    addChatMensaje("asistente", msg);
    console.error("asistente:", e);
    return NextResponse.json({ ok: false, respuesta: msg }, { status: 502 });
  }

  // Feedback con fotos: preparar (resuelve el contacto) o enviar (encola fotos+texto).
  // La respuesta se CONSTRUYE en el backend (con el nombre real del contacto), no la
  // improvisa la IA — así Mary ve siempre a quién y qué se manda.
  let enviado = false;
  if (accion.accion === "preparar_envio") {
    const r = prepararEnvio({ destinatario: accion.destinatario, mensaje: accion.mensaje, fotos });
    addChatMensaje("asistente", r.respuesta);
    return NextResponse.json({ ok: true, respuesta: r.respuesta, preparado: true });
  }
  if (accion.accion === "enviar") {
    const r = ejecutarEnvio();
    enviado = r.ok;
    addChatMensaje("asistente", r.respuesta);
    return NextResponse.json({ ok: true, respuesta: r.respuesta, enviado });
  }

  // Si la IA quiere registrar, va al MISMO lugar que los botones (ingresos/costos),
  // así aparece en Ganancias/Costos y en Métricas. (origen 'texto'|'audio' ya no
  // se usa como columna, pero se mantiene por compatibilidad del contrato.)
  let registrado = false;
  let agendado = false;
  if (accion.accion === "registrar" && accion.monto && accion.monto > 0 && accion.tipo) {
    const fecha = nowSantiago().slice(0, 10); // YYYY-MM-DD, como el botón "Agregar"
    if (accion.tipo === "ingreso") {
      addIngreso({ fecha, monto: accion.monto, tipo: accion.categoria, detalle: accion.descripcion });
    } else {
      addCosto({ fecha, valor: accion.monto, tipo: accion.categoria, notas: accion.descripcion });
    }
    registrado = true;
  } else if (accion.accion === "agendar" && accion.fecha && /^\d{4}-\d{2}-\d{2}$/.test(accion.fecha)) {
    // Agenda una clase/evento en el calendario. El 'dia' se deriva de la fecha.
    const dia = diaFromFecha(accion.fecha);
    const alumnos: string[] = accion.alumnos && accion.alumnos.includes(",")
      ? accion.alumnos.split(",").map((s) => s.trim()).filter(Boolean)
      : accion.alumnos && accion.alumnos.trim()
        ? [accion.alumnos.trim()]
        : [];
    addClase({
      fecha: accion.fecha,
      dia,
      profe: accion.profe || "Mary",
      hora: accion.hora,
      alumnos,
      nota: accion.titulo,
    });
    agendado = true;
  }

  // Guardar respuesta del asistente
  addChatMensaje("asistente", accion.respuesta);

  return NextResponse.json({ ok: true, respuesta: accion.respuesta, registrado, agendado });
}
