import { NextRequest, NextResponse } from "next/server";
import { addClase } from "@/lib/db";
import { diaFromFecha, PROFE_NOMBRES } from "@/lib/calendario";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

interface ClaseParse { fecha?: string; hora?: string | null; profe?: string; alumnos?: string[]; titulo?: string }

// Crea UNA o VARIAS clases a partir de lo que Mary DICTÓ (texto ya transcrito). La IA
// extrae todas las clases (distintos días y/o profes en un mismo audio); los alumnos se
// guardan como nombres.
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
  const system = `Eres el asistente de agenda de la academia de arte Arteluk. Mary DICTA una o VARIAS clases (puede mencionar distintos días y/o distintas profes en un mismo dictado). Extrae TODAS y devuelve SOLO un JSON válido, sin texto extra:
{"clases":[{"fecha":"YYYY-MM-DD","hora":"HH:MM" (o null),"profe":"Mary" o "Paula","alumnos":["Nombre1","Nombre2"],"titulo":"<motivo/taller o cadena vacía>"}]}

Reglas:
- Puede haber 1 o VARIAS clases. Ej: "el lunes con Paula y el martes a las 5 con Mary" = DOS clases. Cada día/profe/hora distinta es una clase aparte.
- Fecha de referencia (el día abierto en el calendario): ${fechaSel} (${diaSel}). "hoy" = esa fecha; "mañana" = día siguiente; un día de la semana ("el martes") = la próxima fecha con ESE día respecto a la referencia. Si una clase no menciona fecha, usa ${fechaSel}.
- profe: SOLO "Mary" o "Paula". Si no lo dice, "Mary".
- hora en 24h "HH:MM" (ej. "a las 4 de la tarde" = "16:00"). Si no dice, null.
- alumnos: nombres mencionados para ESA clase (ej. "con Sofía y Juan" → ["Sofía","Juan"]). Si solo dice cantidad ("3 niños"), deja [] y ponlo en titulo.
- titulo: el motivo/taller si lo menciona, si no "".
Español chileno. Devuelve SOLO el JSON con el array "clases".`;

  let arr: ClaseParse[] = [];
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: [{ role: "user", content: texto }] }),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: "No se pudo interpretar" }, { status: 502 });
    const data = (await res.json()) as { content?: { text?: string }[] };
    const raw = (data.content?.[0]?.text ?? "").trim().replace(/^```json?/i, "").replace(/```$/, "").trim();
    const obj = JSON.parse(raw);
    arr = Array.isArray(obj) ? obj : Array.isArray(obj?.clases) ? obj.clases : [obj];
  } catch {
    return NextResponse.json({ ok: false, error: "No entendí la clase. Prueba de nuevo, ej: «clase con Paula el martes a las 4 con Sofía»." }, { status: 502 });
  }

  const creadas: { id: number; fecha: string; profe: string; hora: string | null; alumnos: string[]; nota: string | null }[] = [];
  for (const p of arr) {
    if (!p || typeof p !== "object") continue;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha ?? "") ? p.fecha! : fechaSel;
    const profe = PROFE_NOMBRES.includes(p.profe ?? "") ? p.profe! : "Mary";
    const hora = /^\d{2}:\d{2}$/.test(p.hora ?? "") ? p.hora! : undefined;
    const alumnos = Array.isArray(p.alumnos) ? p.alumnos.filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim()) : [];
    const nota = (p.titulo ?? "").trim() || undefined;
    const id = addClase({ fecha, dia: diaFromFecha(fecha), profe, hora, alumnos, nota });
    creadas.push({ id, fecha, profe, hora: hora ?? null, alumnos, nota: nota ?? null });
  }

  if (creadas.length === 0) return NextResponse.json({ ok: false, error: "No entendí ninguna clase. Prueba de nuevo." }, { status: 502 });
  return NextResponse.json({ ok: true, clases: creadas });
}
