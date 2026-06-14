import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { messages, contactName } = await req.json() as { messages: { role: string; content: string }[]; contactName: string };

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model  = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";
  if (!apiKey) return NextResponse.json({ ok: false, error: "Falta OPENROUTER_API_KEY" }, { status: 500 });

  const system = `Eres un asistente de ventas de Waly. El cliente "${contactName}" escribió por WhatsApp. Analiza la conversación y sugiere UNA respuesta corta (máximo 3 líneas) que podría enviar el operador humano. En español chileno, sin saludos largos. Solo el texto de la respuesta.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://conejeros-solutions.cl", "X-Title": "Waly Panel" },
      body: JSON.stringify({ model, max_tokens: 200, messages: [{ role: "system", content: system }, ...messages.slice(-10).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))] }),
    });
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return NextResponse.json({ ok: true, suggestion: data.choices?.[0]?.message?.content?.trim() ?? "" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
