// Procesamiento de medios entrantes de WhatsApp para que el bot "vea" fotos y
// "escuche" audios. Estrategia: convertir el medio a TEXTO y dejar que el flujo
// normal (ai.ts) lo razone como un mensaje más. Así no tocamos el loop de tools.
//  · Imagen → Claude vision la describe (usa ANTHROPIC_API_KEY, ya disponible).
//  · Audio  → transcripción (Groq Whisper si hay GROQ_API_KEY; OpenAI si no).
// NUNCA lanza: si algo falla, devuelve null y el mensaje igual se guarda/muestra.
import pino from "pino";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Modelo barato con visión para describir imágenes (no usa el modelo caro del bot).
const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL ?? "claude-haiku-4-5-20251001";

const MIME_IMG_OK = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Describe en español, breve y factual, una imagen que envió alguien a la academia
// de arte (un cuadro, un dibujo, un comprobante de pago, etc.). Usa fetch directo a
// la API de Anthropic (Mary no tiene el SDK). Devuelve null ante cualquier error.
export async function describirImagen(buffer: Buffer, mime: string): Promise<string | null> {
  try {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) return null;
    const tipo = MIME_IMG_OK.has(mime) ? mime : "image/jpeg";
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 200,
        system:
          "Eres asistente de una academia de arte (Arteluk). Te llega una imagen que envió " +
          "alguien por WhatsApp. Descríbela en español en 1-2 frases, factual y útil (ej: " +
          "'foto de un cuadro al óleo', 'comprobante de transferencia por $30.000', 'un dibujo " +
          "de un niño'). Si trae texto/montos/fechas, inclúyelos. No inventes.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: tipo, data: buffer.toString("base64") } },
              { type: "text", text: "¿Qué es esta imagen?" },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, body: (await res.text()).slice(0, 160) }, "describirImagen: error API");
      return null;
    }
    const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const t = data.content?.find((b) => b.type === "text");
    return t?.text?.trim() || null;
  } catch (e) {
    logger.warn({ err: String(e).slice(0, 120) }, "describirImagen falló");
    return null;
  }
}

// Transcribe un audio (nota de voz) a texto. Usa Groq Whisper (gratis/rápido) o
// OpenAI Whisper. Si no hay ninguna clave configurada, devuelve null. Nunca lanza.
export async function transcribirAudio(buffer: Buffer, mime: string): Promise<string | null> {
  const groq = process.env.GROQ_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (!groq && !openai) {
    logger.warn("transcribirAudio: falta GROQ_API_KEY (o OPENAI_API_KEY) — audio no transcrito");
    return null;
  }
  const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("mpeg") ? "mp3" : "ogg";
  const url = groq
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";
  const model = groq ? "whisper-large-v3-turbo" : "whisper-1";
  const key = groq ?? openai!;
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mime || "audio/ogg" }), `audio.${ext}`);
    form.append("model", model);
    form.append("language", "es");
    form.append("response_format", "text");
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!r.ok) {
      logger.warn({ status: r.status, body: (await r.text()).slice(0, 160) }, "transcribirAudio: error API");
      return null;
    }
    const txt = (await r.text()).trim();
    return txt || null;
  } catch (e) {
    logger.warn({ err: String(e).slice(0, 120) }, "transcribirAudio falló");
    return null;
  }
}
