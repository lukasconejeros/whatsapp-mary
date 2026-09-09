// API de FORMULARIOS (panel de Mary, detrás del login).
//
// El envío NO abre una vía nueva de mensajería: encola en `seguimientos`, la misma
// cola con goteo (40-90 s), tope diario (35) y ventana 9:00-21:00 que ya existe.
// Anti-baneo es la regla dura del negocio: una ráfaga cuesta el número de Arteluk.
import { NextRequest, NextResponse } from "next/server";
import {
  listFormularios, getFormulario, listSlugsFormularios, crearFormulario, actualizarFormulario,
  borrarFormulario, contarRespuestas, listEnviosFormulario, registrarEnvioFormulario,
  marcarEnvioEncolado, candidatosFormulario, AUDIENCIAS, type Audiencia,
  getOrCreateConversation, enqueueSeguimientos, omitirSeguimientosPendientes,
  getSeguimientoStats, getConnectionState, getConfig, setConfig,
} from "@/lib/db";
import {
  sanearFormulario, slugLibre, nuevoToken, linkFormulario, armarMensaje,
  MSG_FORMULARIO_KEY, MENSAJE_FORMULARIO_DEFAULT, CIERRE_POR_DEFECTO,
} from "@/lib/formularios";
import { todaySantiago } from "@/lib/fechas";
import { limitar } from "@/lib/ratelimit";
import { normalizeChilePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

// La dirección pública sale de APP_URL; si no está puesta, se deduce de la petición.
// Nunca se inventa un dominio: un link roto en un envío masivo son 35 mensajes perdidos.
function base(req: NextRequest): string {
  const env = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

export function GET(req: NextRequest) {
  const formularios = listFormularios().map((f) => {
    const envios = listEnviosFormulario(f.id);
    return {
      ...f,
      link: linkFormulario(f.slug, null, base(req)),
      respuestas: contarRespuestas(f.id),
      enviados: envios.filter((e) => e.estado !== "omitido").length,
    };
  });
  return NextResponse.json({
    ok: true,
    formularios,
    audiencias: (Object.keys(AUDIENCIAS) as Audiencia[]).map((k) => ({
      clave: k, nombre: AUDIENCIAS[k], candidatos: candidatosFormulario(k).length,
    })),
    plantilla: getConfig(MSG_FORMULARIO_KEY, MENSAJE_FORMULARIO_DEFAULT),
    cierreDefecto: CIERRE_POR_DEFECTO,
    stats: getSeguimientoStats(todaySantiago()),
    conectado: getConnectionState().status === "connected",
  });
}

export async function POST(req: NextRequest) {
  const rl = limitar(req, "formularios", 40); if (rl) return rl;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = {}; }
  const action = String(body.action ?? "");

  // ── Crear ────────────────────────────────────────────────────────────────
  if (action === "crear") {
    const d = sanearFormulario(body.formulario);
    if (!d) return NextResponse.json({ ok: false, error: "Falta el título o alguna pregunta" }, { status: 400 });
    const slug = slugLibre(d.titulo, listSlugsFormularios());
    const id = crearFormulario(slug, d);
    return NextResponse.json({ ok: true, id, slug, link: linkFormulario(slug, null, base(req)) });
  }

  // ── Editar ───────────────────────────────────────────────────────────────
  if (action === "editar") {
    const id = Number(body.id);
    const d = sanearFormulario(body.formulario);
    if (!id || !d) return NextResponse.json({ ok: false, error: "Falta el título o alguna pregunta" }, { status: 400 });
    if (!actualizarFormulario(id, d)) return NextResponse.json({ ok: false, error: "No existe ese formulario" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // ── Borrar ───────────────────────────────────────────────────────────────
  if (action === "borrar") {
    const id = Number(body.id);
    if (!id || !borrarFormulario(id)) return NextResponse.json({ ok: false, error: "No existe ese formulario" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // ── Guardar la plantilla del mensaje ─────────────────────────────────────
  if (action === "plantilla") {
    const t = String(body.plantilla ?? "").trim().slice(0, 900);
    if (!t) return NextResponse.json({ ok: false, error: "El mensaje no puede ir vacío" }, { status: 400 });
    setConfig(MSG_FORMULARIO_KEY, t);
    return NextResponse.json({ ok: true });
  }

  // ── Vista previa: qué le va a llegar exactamente a la persona ────────────
  if (action === "previsualizar") {
    const id = Number(body.id);
    const f = id ? getFormulario(id) : null;
    if (!f) return NextResponse.json({ ok: false, error: "No existe ese formulario" }, { status: 404 });
    const plantilla = getConfig(MSG_FORMULARIO_KEY, MENSAJE_FORMULARIO_DEFAULT);
    const linkEjemplo = linkFormulario(f.slug, "ejemplodelink123", base(req));
    return NextResponse.json({ ok: true, mensaje: armarMensaje(plantilla, "María José", linkEjemplo) });
  }

  // ── Mandar UNA prueba a un teléfono concreto ────────────────────────────
  // Paso obligatorio antes del envío masivo: el link se abre y se comprueba de
  // verdad, en vez de descubrir que estaba roto después de 35 mensajes.
  if (action === "prueba") {
    const tel = normalizeChilePhone(String(body.telefono ?? ""));
    const id = Number(body.id);
    const f = id ? getFormulario(id) : null;
    if (!f) return NextResponse.json({ ok: false, error: "No existe ese formulario" }, { status: 404 });
    if (!tel) return NextResponse.json({ ok: false, error: "Ese número no se entiende. Escríbelo como +56912345678" }, { status: 400 });
    if (getConnectionState().status !== "connected") {
      return NextResponse.json({ ok: false, error: "WhatsApp no está conectado. Revisa Conexión y vuelve a intentarlo." }, { status: 409 });
    }
    const conv = getOrCreateConversation(tel, "Prueba de formulario");
    const plantilla = getConfig(MSG_FORMULARIO_KEY, MENSAJE_FORMULARIO_DEFAULT);
    // La prueba lleva token propio y NO se anota en formulario_envios: si se anotara,
    // el candado de "no mandar dos veces" dejaría fuera a esa persona del envío real.
    const link = linkFormulario(f.slug, nuevoToken(), base(req));
    enqueueSeguimientos([{ id: conv.id, phone: tel, mensaje: armarMensaje(plantilla, conv.name, link) }]);
    return NextResponse.json({ ok: true, enviados: 1 });
  }

  // ── Envío de verdad ──────────────────────────────────────────────────────
  if (action === "enviar") {
    const id = Number(body.id);
    const f = id ? getFormulario(id) : null;
    if (!f) return NextResponse.json({ ok: false, error: "No existe ese formulario" }, { status: 404 });
    if (!f.activo) return NextResponse.json({ ok: false, error: "Ese formulario está cerrado. Ábrelo antes de mandarlo." }, { status: 400 });

    const aud = String(body.audiencia ?? "") as Audiencia;
    if (!(aud in AUDIENCIAS)) return NextResponse.json({ ok: false, error: "Falta elegir a quién mandarlo" }, { status: 400 });
    if (getConnectionState().status !== "connected") {
      return NextResponse.json({ ok: false, error: "WhatsApp no está conectado. Revisa Conexión y vuelve a intentarlo." }, { status: 409 });
    }

    // Si viene una selección a mano, manda esa; si no, la audiencia entera.
    const marcados = Array.isArray(body.telefonos)
      ? new Set(body.telefonos.map((t) => normalizeChilePhone(String(t))).filter(Boolean) as string[])
      : null;

    const candidatos = candidatosFormulario(aud).filter((c) => !marcados || marcados.has(c.telefono));

    const items: { id: number; phone: string; mensaje: string }[] = [];
    const enviosNuevos: number[] = [];
    let repetidos = 0;
    const plantilla = getConfig(MSG_FORMULARIO_KEY, MENSAJE_FORMULARIO_DEFAULT);

    for (const c of candidatos) {
      const fila = registrarEnvioFormulario(f.id, nuevoToken(), c.telefono, c.nombre, c.conversationId);
      if (!fila) { repetidos++; continue; } // ya se le había mandado este formulario
      const conv = c.conversationId ? { id: c.conversationId } : getOrCreateConversation(c.telefono, c.nombre ?? undefined);
      enviosNuevos.push(fila.id);
      items.push({
        id: conv.id,
        phone: c.telefono,
        mensaje: armarMensaje(plantilla, c.nombre, linkFormulario(f.slug, fila.token, base(req))),
      });
    }

    const encolados = enqueueSeguimientos(items);
    for (const eid of enviosNuevos) marcarEnvioEncolado(eid);

    return NextResponse.json({
      ok: true, encolados, repetidos, candidatos: candidatos.length,
      stats: getSeguimientoStats(todaySantiago()),
    });
  }

  // ── Detener lo que quede pendiente ───────────────────────────────────────
  if (action === "detener") {
    return NextResponse.json({ ok: true, cancelados: omitirSeguimientosPendientes() });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida" }, { status: 400 });
}
