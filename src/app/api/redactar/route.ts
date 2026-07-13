import { NextRequest, NextResponse } from "next/server";
import { getConversationById, getClienteByPhone } from "@/lib/db";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

// Convierte una nota informal de Mary en un mensaje cálido y corto para el apoderado
// de ESTA conversación, usando su nombre y el del niño. No lo envía: lo devuelve para
// que Mary lo revise/edite y lo mande ella.
export async function POST(req: NextRequest) {
  const rl = limitar(req, "redactar"); if (rl) return rl;
  let body: { conversationId?: number; texto?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }
  const texto = (body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ ok: false, error: "Escribe primero qué quieres decir" }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Falta configurar la IA" }, { status: 500 });

  const conv = body.conversationId ? getConversationById(body.conversationId) : null;
  const nombre = conv?.name || "el apoderado";
  const cli = conv ? getClienteByPhone(conv.phone) : null;
  const nino = cli?.alumnos ? ` (apoderado de ${cli.alumnos})` : "";

  const system = `Eres la asistente de Mary, dueña de la academia de arte Arteluk (Chile). Mary te da una NOTA INFORMAL sobre un niño/a y quiere mandarle un mensaje bonito al apoderado ${nombre}${nino} por WhatsApp.

Reescribe la nota como un mensaje CÁLIDO, cercano y CORTO (máximo 2-3 frases), en español chileno con tuteo (nunca "vos/podés"), usando el nombre del niño/a si aparece. SIN EXAGERAR: nada de superlativos falsos, promesas ni "el mejor del mundo"; suena honesto y natural. 1-2 emojis suaves como mucho. NO agregues firma ni cierres con "— Mary" o "Arteluk"; el mensaje termina en el contenido, sin firma.

Devuelve SOLO el mensaje final, sin comillas, sin explicaciones, sin opciones.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 250, system, messages: [{ role: "user", content: texto }] }),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: "No se pudo redactar" }, { status: 502 });
    const data = (await res.json()) as { content?: { text?: string }[] };
    const mensaje = (data.content?.[0]?.text ?? "").trim();
    if (!mensaje) return NextResponse.json({ ok: false, error: "No se pudo redactar" }, { status: 502 });
    return NextResponse.json({ ok: true, mensaje });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo redactar" }, { status: 500 });
  }
}
