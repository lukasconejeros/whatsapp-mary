import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

type Msg = { role: string; content: string };

// Redacta una sugerencia de respuesta para Mary Y un consejo estratégico corto.
// Pensado sobre todo para leads de Meta y clientes que dejaron de responder.
// (Antes usaba OpenRouter — key placeholder en prod, se caía. Ahora Anthropic directo.)
export async function POST(req: NextRequest) {
  let body: { messages?: Msg[]; contactName?: string; categoria?: string; diasSinResponder?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const contactName = body.contactName || "el contacto";
  const categoria = body.categoria || "";
  const dias = typeof body.diasSinResponder === "number" ? body.diasSinResponder : null;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });

  const quien =
    categoria === "potencial"
      ? `"${contactName}" es un POSIBLE CLIENTE que llegó por un anuncio de Meta (aún no es alumno). El objetivo es acercarlo: entender qué busca e invitarlo a una clase de prueba o al taller.`
      : categoria === "arteluk"
        ? `"${contactName}" es un apoderado de Arteluk (cliente). El objetivo es cuidar la relación y, si dejó de venir, reactivarlo.`
        : `"${contactName}" escribió por WhatsApp.`;
  const silencio = dias && dias >= 2 ? ` Lleva ${dias} días sin responder, considera un mensaje de reenganche.` : "";

  const system = `Eres la asistente de Mary, dueña de "Arteluk", una academia de clases de arte para niños en Chile. ${quien}${silencio}

Tu tarea tiene DOS partes:
1) "suggestion": UNA respuesta corta (máx 3 líneas) para que Mary le mande al contacto. Cálida, cercana, español chileno con tuteo (nunca "vos/podés"), sin saludos largos ni exagerar. Orientada a invitar a clases, resolver la duda o hacer seguimiento. Solo el texto, sin comillas.
2) "tip": UN consejo estratégico MUY corto (1 frase) para Mary sobre qué conviene hacer con este contacto (ej: "Lleva días sin responder: ofrécele una promo de 2x1 en la clase de prueba", "Está interesado pero dudando el precio: invítalo a una clase gratis esta semana", "Ya es cliente: pregúntale cómo va la niña y recuérdale el taller del sábado"). Práctico y realista; si sugieres una promo, deja claro que es una idea para que Mary decida.

Devuelve SIEMPRE y SOLO un JSON: {"suggestion":"<respuesta>","tip":"<consejo>"}`;

  const anthMessages = messages.slice(-10).map((m) => ({
    role: m.role === "user" ? "user" : ("assistant" as "user" | "assistant"),
    content: m.content,
  }));
  // La API de Anthropic exige que el primer mensaje sea del usuario.
  while (anthMessages.length && anthMessages[0].role === "assistant") anthMessages.shift();
  if (anthMessages.length === 0) anthMessages.push({ role: "user", content: "(sin mensajes previos)" });

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, system, messages: anthMessages }),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: `Anthropic ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { content?: { text?: string }[] };
    const raw = data.content?.[0]?.text ?? "";
    let suggestion = raw.trim();
    let tip = "";
    const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
    if (s !== -1 && e > s) {
      try {
        const obj = JSON.parse(raw.slice(s, e + 1)) as { suggestion?: string; tip?: string };
        if (obj.suggestion) suggestion = obj.suggestion.trim();
        if (obj.tip) tip = obj.tip.trim();
      } catch { /* deja el texto crudo como suggestion */ }
    }
    return NextResponse.json({ ok: true, suggestion, tip });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
