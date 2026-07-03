import { listMovimientos, listIngresos, listCostos, listClases, listClientes, listChatMensajes } from "./db";
import { monthSantiago, nowSantiago } from "./fechas";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface AccionIA {
  accion: "registrar" | "responder" | "agendar";
  tipo?: "gasto" | "ingreso";
  monto?: number;
  categoria?: string;
  descripcion?: string;
  // Campos de AGENDAR (calendario):
  fecha?: string;   // YYYY-MM-DD
  hora?: string;    // HH:MM
  profe?: string;   // Mary | Paula | Lusmaría
  alumnos?: string; // nombres separados por coma, o descripción de cantidad ("3 niñas")
  titulo?: string;  // taller o motivo del evento
  respuesta: string;
}

export function parseAccionIA(raw: string): AccionIA {
  const fallback: AccionIA = {
    accion: "responder",
    respuesta: raw.trim() || "No te entendí, ¿me lo repites?",
  };
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return fallback;
  }
  const respuesta = typeof obj.respuesta === "string" ? obj.respuesta : "";
  if (!respuesta) return fallback;
  if (obj.accion === "registrar") {
    return {
      accion: "registrar",
      tipo: obj.tipo === "ingreso" ? "ingreso" : "gasto",
      monto: Math.round(Number(obj.monto) || 0),
      categoria: typeof obj.categoria === "string" ? obj.categoria : undefined,
      descripcion: typeof obj.descripcion === "string" ? obj.descripcion : undefined,
      respuesta,
    };
  }
  if (obj.accion === "agendar") {
    return {
      accion: "agendar",
      fecha: typeof obj.fecha === "string" ? obj.fecha : undefined,
      hora: typeof obj.hora === "string" ? obj.hora : undefined,
      profe: typeof obj.profe === "string" ? obj.profe : undefined,
      alumnos: typeof obj.alumnos === "string" ? obj.alumnos : undefined,
      titulo: typeof obj.titulo === "string" ? obj.titulo : undefined,
      respuesta,
    };
  }
  return { accion: "responder", respuesta };
}

export function construirContexto(mes = monthSantiago()): string {
  const movs = listMovimientos({ mes });
  const ingresos = listIngresos(mes);
  const costos = listCostos(mes);
  const clases = listClases();
  const clientes = listClientes();

  const lineas: string[] = [];
  lineas.push(`MES: ${mes}`);
  lineas.push("");
  lineas.push("MOVIMIENTOS (caja del asistente):");
  for (const m of movs) {
    lineas.push(`- ${m.fecha} ${m.tipo} $${m.monto} ${m.categoria ?? ""} ${m.descripcion ?? ""}`.trim());
  }
  lineas.push("");
  lineas.push("INGRESOS (finanzas):");
  for (const i of ingresos) lineas.push(`- ${JSON.stringify(i)}`);
  lineas.push("");
  lineas.push("COSTOS (finanzas):");
  for (const c of costos) lineas.push(`- ${JSON.stringify(c)}`);
  lineas.push("");
  lineas.push("CLASES (calendario):");
  for (const cl of clases) {
    lineas.push(`- ${cl.dia} ${cl.profe} ${cl.hora ?? ""} alumnos:${cl.alumnos.join(", ")} ${cl.nota ?? ""}`.trim());
  }
  lineas.push("");
  lineas.push("CLIENTES:");
  for (const cliente of clientes) {
    lineas.push(`- ${cliente.nombre ?? "(sin nombre)"} tel:${cliente.telefono} horario:${cliente.horario.join(", ")}`);
  }
  return lineas.join("\n");
}

const SYSTEM = `Eres el asistente de finanzas y calendario de Mary, que tiene una academia de arte (Arteluk) en Chile. Hablas en español chileno con tuteo, cálido y breve.

Tu trabajo es TRES cosas:
1) REGISTRAR un gasto o ingreso cuando Mary te lo cuenta (ej: "gasté 5 lucas en pinturas", "me pagaron 30 mil de la clase").
2) AGENDAR una clase o evento en el calendario cuando Mary te lo pide (ej: "el sábado Paula tiene clase con 3 niñas", "agenda óleo el 12 a las 10").
3) RESPONDER preguntas sobre finanzas (gastos, ingresos, saldo, por categoría) y calendario (clases, profes, alumnos) usando SOLO los datos del CONTEXTO. Si el dato no está en el contexto, dilo con honestidad; nunca inventes cifras.

INTERPRETACIÓN DE MONTOS CHILENOS (en pesos CLP, número entero):
- "5 lucas" o "5 luca" = 5000
- "X mil" = X * 1000 (ej: "30 mil" = 30000)
- "un palo" / "1 palo" = 1000000
- NUNCA conviertas "mil" en millones. "5 mil" son 5000, no 5.000.000.

Si el mensaje NO es claramente un gasto/ingreso ni una orden de agendar (saludo, pregunta, charla), NO registres ni agendes nada: responde.

PREGUNTA SI FALTA INFORMACIÓN antes de registrar o agendar. Fíjate si tienes lo esencial:
- Para un INGRESO de una clase o mensualidad necesitas saber DE QUÉ TALLER O CLASE es (ej: óleo, dibujo, acuarela, niños). Si no te lo dijeron, NO registres todavía.
- Para un GASTO necesitas saber EN QUÉ se gastó. Si no está claro, NO registres todavía.
- Para AGENDAR necesitas la FECHA EXACTA (día) y la HORA. Si falta alguna, pídela.
Cuando falte ese dato, usa accion "responder" y pregúntalo de forma corta y cálida (ej: "¿De qué taller es la mensualidad de Claudia?", "¿A qué hora es la clase del sábado?"). Usa los MENSAJES ANTERIORES de la conversación para juntar la información.

FECHAS RELATIVAS: tienes la fecha de HOY en el contexto. Resuelve tú mismo "hoy", "mañana", "el sábado", "el 12" a una fecha exacta en formato YYYY-MM-DD. Las profes son Mary, Paula y Lusmaría (pon una solo si Mary la menciona).

CONFIRMA SIEMPRE ANTES DE REGISTRAR O AGENDAR. Nunca anotes ni agendes de una.
- Para registrar: cuando ya tengas todo (tipo, monto y de qué es), primero REPITE lo que entendiste y pide confirmación con accion "responder" (ej: "Anoto un gasto de $5.000 en materiales (pinturas), ¿lo confirmo? ✅"). Usa accion "registrar" SOLO cuando Mary confirme.
- Para agendar: cuando ya tengas fecha y hora, primero REPITE con la FECHA EXACTA y pide confirmación con accion "responder" (ej: "Agendo clase de óleo el sábado 12/07 a las 10:00 con Paula (3 niñas), ¿lo confirmo? ✅"). Usa accion "agendar" SOLO cuando Mary confirme.
En ambos casos usa accion definitiva SOLO cuando Mary confirme en su mensaje siguiente ("sí", "dale", "correcto", "confirmo", "ya", etc.). Si Mary corrige un dato, vuelve a confirmar con el dato corregido. Si Mary dice que no, no hagas nada y pregúntale qué cambiar.

IMPORTANTE: la "respuesta" debe ser MUY corta, máximo 1 o 2 frases. Nada de explicaciones largas ni listas extensas.

Devuelve SIEMPRE y SOLO un JSON (sin texto antes ni después), con una de estas formas:
- Para registrar: {"accion":"registrar","tipo":"gasto"|"ingreso","monto":<entero>,"categoria":"<corta>","descripcion":"<breve>","respuesta":"<confirmación cálida y breve>"}
- Para agendar: {"accion":"agendar","fecha":"YYYY-MM-DD","hora":"HH:MM","profe":"Mary|Paula|Lusmaría","alumnos":"<nombres separados por coma o cantidad>","titulo":"<taller o motivo>","respuesta":"<confirmación cálida y breve>"}
- Para responder: {"accion":"responder","respuesta":"<respuesta breve usando solo el contexto>"}`;

export async function procesarMensaje(texto: string, mes = monthSantiago()): Promise<AccionIA> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY");
  const contexto = construirContexto(mes);
  const system = `${SYSTEM}\n\nHoy es ${nowSantiago().slice(0, 10)}.\n\nCONTEXTO ACTUAL (datos del mes, úsalos para responder):\n${contexto}`;

  // Memoria de la conversación: últimos mensajes en orden, alternando user/assistant
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of listChatMensajes(12)) {
    const role: "user" | "assistant" = m.rol === "asistente" ? "assistant" : "user";
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content += "\n" + m.texto;
    else messages.push({ role, content: m.texto });
  }
  while (messages.length && messages[0].role === "assistant") messages.shift();
  if (messages.length === 0) messages.push({ role: "user", content: texto });

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  const raw = data.content?.[0]?.text ?? "";
  return parseAccionIA(raw);
}

// Transcribe voz → texto. Usa Groq Whisper (gratis/rápido) si hay GROQ_API_KEY,
// si no OpenAI. Sin ninguna clave no se puede transcribir (lanza error claro).
export async function transcribirAudio(buffer: Buffer, filename = "audio.webm"): Promise<string> {
  const groq = process.env.GROQ_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (!groq && !openai) {
    throw new Error("Falta GROQ_API_KEY (o OPENAI_API_KEY) para transcribir el audio");
  }
  const url = groq ? "https://api.groq.com/openai/v1/audio/transcriptions" : WHISPER_URL;
  const model = groq ? "whisper-large-v3-turbo" : "whisper-1";
  const key = groq ?? openai!;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  form.append("model", model);
  form.append("language", "es");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcripción ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
