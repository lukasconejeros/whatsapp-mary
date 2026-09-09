// API PÚBLICA del formulario: la usa la persona que abre el link desde su teléfono.
// No hay login acá (es el punto), así que TODO lo que llega se trata como hostil:
//   · la validación se rehace en el servidor, aunque el HTML ya la haya hecho;
//   · el token se comprueba con la forma exacta antes de tocar la base;
//   · un token que ya contestó no puede contestar dos veces (candado en la base);
//   · rate-limit por IP, porque el link se puede reenviar a cualquiera.
import { NextRequest, NextResponse } from "next/server";
import { getFormularioPorSlug, getEnvioPorToken, guardarRespuesta } from "@/lib/db";
import { validarRespuestas, esTokenValido } from "@/lib/formularios";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const rl = limitar(req, "form-publico", 60); if (rl) return rl;
  const { slug } = await params;
  const f = getFormularioPorSlug(slug);
  if (!f || !f.activo || f.preguntas.length === 0) {
    return NextResponse.json({ ok: false, error: "cerrado" }, { status: 404 });
  }

  // Con token: se saluda por su nombre y se sabe si ya contestó.
  const t = req.nextUrl.searchParams.get("t");
  let nombre: string | null = null;
  let yaContesto = false;
  if (esTokenValido(t)) {
    const e = getEnvioPorToken(t);
    if (e && e.formulario_id === f.id) {
      nombre = e.nombre;
      yaContesto = e.estado === "respondido";
    }
  }

  // Nunca se devuelve el teléfono ni nada de la base más allá del nombre de pila.
  return NextResponse.json({
    ok: true,
    formulario: { titulo: f.titulo, intro: f.intro, cierre: f.cierre, preguntas: f.preguntas },
    nombre: nombre ? nombre.trim().split(/\s+/)[0] : null,
    yaContesto,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const rl = limitar(req, "form-responder", 12); if (rl) return rl;
  const { slug } = await params;
  const f = getFormularioPorSlug(slug);
  if (!f || !f.activo || f.preguntas.length === 0) {
    return NextResponse.json({ ok: false, error: "Este formulario ya está cerrado." }, { status: 404 });
  }

  let body: { token?: unknown; respuestas?: unknown };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  const v = validarRespuestas(f.preguntas, body.respuestas);
  if (!v.ok) return NextResponse.json({ ok: false, errores: v.errores }, { status: 400 });

  let token: string | null = null;
  let telefono: string | null = null;
  let nombre: string | null = null;
  if (esTokenValido(body.token)) {
    const e = getEnvioPorToken(body.token);
    // Un token de OTRO formulario no sirve acá: si se aceptara, la respuesta quedaría
    // colgada de la persona equivocada.
    if (e && e.formulario_id === f.id) { token = e.token; telefono = e.telefono; nombre = e.nombre; }
  }

  if (!guardarRespuesta(f.id, token, telefono, nombre, v.limpias)) {
    return NextResponse.json({ ok: false, error: "Ya habíamos recibido su respuesta. ¡Gracias!" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, cierre: f.cierre });
}
