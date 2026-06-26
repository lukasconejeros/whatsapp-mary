import { listMovimientos, listIngresos, listCostos, listClases, listClientes } from "./db";
import { monthSantiago, nowSantiago } from "./fechas";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface AccionIA {
  accion: "registrar" | "responder";
  tipo?: "gasto" | "ingreso";
  monto?: number;
  categoria?: string;
  descripcion?: string;
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

Tu trabajo es DOS cosas:
1) REGISTRAR un gasto o ingreso cuando Mary te lo cuenta (ej: "gasté 5 lucas en pinturas", "me pagaron 30 mil de la clase").
2) RESPONDER preguntas sobre finanzas (gastos, ingresos, saldo, por categoría) y calendario (clases, profes, alumnos) usando SOLO los datos del CONTEXTO. Si el dato no está en el contexto, dilo con honestidad; nunca inventes cifras.

INTERPRETACIÓN DE MONTOS CHILENOS (en pesos CLP, número entero):
- "5 lucas" o "5 luca" = 5000
- "X mil" = X * 1000 (ej: "30 mil" = 30000)
- "un palo" / "1 palo" = 1000000
- NUNCA conviertas "mil" en millones. "5 mil" son 5000, no 5.000.000.

Si el mensaje NO es claramente un gasto/ingreso (saludo, pregunta, charla), NO registres nada: responde.

IMPORTANTE: la "respuesta" debe ser MUY corta, máximo 1 o 2 frases. Nada de explicaciones largas ni listas extensas.

Devuelve SIEMPRE y SOLO un JSON (sin texto antes ni después), con una de estas dos formas:
- Para registrar: {"accion":"registrar","tipo":"gasto"|"ingreso","monto":<entero>,"categoria":"<corta>","descripcion":"<breve>","respuesta":"<confirmación cálida y breve>"}
- Para responder: {"accion":"responder","respuesta":"<respuesta breve usando solo el contexto>"}`;

export async function procesarMensaje(texto: string, mes = monthSantiago()): Promise<AccionIA> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY");
  const contexto = construirContexto(mes);
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [
        { role: "user", content: `CONTEXTO:\n${contexto}\n\nMENSAJE DE MARY (fecha ${nowSantiago().slice(0, 10)}):\n${texto}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  const raw = data.content?.[0]?.text ?? "";
  return parseAccionIA(raw);
}

export async function transcribirAudio(buffer: Buffer, filename = "audio.webm"): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  form.append("model", "whisper-1");
  form.append("language", "es");
  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
