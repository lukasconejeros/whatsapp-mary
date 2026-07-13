import { NextRequest, NextResponse } from "next/server";
import { addClase } from "@/lib/db";
import { diaFromFecha, PROFE_NOMBRES } from "@/lib/calendario";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

// Crea una clase a partir de lo que Mary DICTÓ (texto ya transcrito por el teléfono).
// La IA extrae fecha/hora/profe/alumnos; los alumnos se guardan como nombres.
export async function POST(req: NextRequest) {
  const rl = limitar(req, "clases-voz", 20); if (rl) return rl;
  let body: { texto?: string; fecha?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  const texto = (body.texto ?? "").trim();
  const fechaSel = /^\d{4}-\d{2}-\d{2}$/.test(body.fecha ?? "") ? body.fecha! : new Date().toISOString().slice(0, 10);
  if (!texto) return NextResponse.json({ ok: false, error: "No se entendió nada. Intenta de nuevo." }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Falta configurar la IA" }, { status: 500 });

  const diaSel = diaFromFecha(fechaSel);
  const system = `Eres el asistente de agenda de la academia de arte Arteluk. Mary DICTA una clase y tú extraes los datos. Devuelve SOLO un JSON válido, sin texto extra:
{"fecha":"YYYY-MM-DD","hora":"HH:MM" (o null),"profe":"Mary" o "Paula","alumnos":["Nombre1","Nombre2"],"titulo":"<motivo/taller o cadena vacía>"}

Reglas:
- Fecha de referencia (el día abierto en el calendario): ${fechaSel} (${diaSel}). Si Mary dice "hoy" usa esa. "mañana" = día siguiente. Si dice un día de la semana ("el martes"), calcula la próxima fecha con ESE día respecto a la referencia. Si no menciona fecha, usa ${fechaSel}.
- profe: SOLO "Mary" o "Paula" (las únicas). Si no lo dice, "Mary".
- hora en 24h "HH:MM" (ej. "a las 4 de la tarde" = "16:00"). Si no dice hora, null.
- alumnos: nombres que menciona (ej. "con Sofía y Juan" → ["Sofía","Juan"]). Si solo dice una cantidad ("3 niños"), deja [] y ponlo en titulo.
- titulo: el motivo/taller si lo menciona (ej. "taller de óleo"), si no "".
Español chileno. Devuelve SOLO el JSON.`;

  let parsed: { fecha?: string; hora?: string | null; profe?: string; alumnos?: string[]; titulo?: string };
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, system, messages: [{ role: "user", content: texto }] }),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: "No se pudo interpretar" }, { status: 502 });
    const data = (await res.json()) as { content?: { text?: string }[] };
    const raw = (data.content?.[0]?.text ?? "").trim().replace(/^```json?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "No entendí la clase. Prueba de nuevo, ej: «clase con Paula el martes a las 4 con Sofía»." }, { status: 502 });
  }

  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha ?? "") ? parsed.fecha! : fechaSel;
  const profe = PROFE_NOMBRES.includes(parsed.profe ?? "") ? parsed.profe! : "Mary";
  const hora = /^\d{2}:\d{2}$/.test(parsed.hora ?? "") ? parsed.hora! : undefined;
  const alumnos = Array.isArray(parsed.alumnos) ? parsed.alumnos.filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim()) : [];
  const nota = (parsed.titulo ?? "").trim() || undefined;

  const id = addClase({ fecha, dia: diaFromFecha(fecha), profe, hora, alumnos, nota });
  return NextResponse.json({ ok: true, clase: { id, fecha, profe, hora: hora ?? null, alumnos, nota: nota ?? null } });
}
