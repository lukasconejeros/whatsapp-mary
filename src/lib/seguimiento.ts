// Campaña de seguimiento (Fase 3): redacción del mensaje y parámetros anti-baneo.
// El planificador vive en seguimiento-loop.ts (proceso del bot); esto es la lógica
// de contenido, reutilizable y testeable.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

function envInt(name: string, def: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}

// Parámetros de la campaña (overridables por env para pruebas). Getters: leen el env
// vigente en cada tick, así se pueden ajustar sin recompilar.
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const CAMPANA = {
  get capDiario() { return envInt("SEGUIMIENTO_MAX_DIA", 35); },                    // tope de envíos por día
  get horaInicio() { return clamp(envInt("SEGUIMIENTO_HORA_INICIO", 9), 0, 23); },  // no mandar antes de las 9
  get horaFin() { return clamp(envInt("SEGUIMIENTO_HORA_FIN", 21), 1, 24); },       // ni después de las 21
  get pausaMinS() { return envInt("SEGUIMIENTO_PAUSA_MIN_S", 40); },                // pausa mínima entre envíos
  get pausaMaxS() { return envInt("SEGUIMIENTO_PAUSA_MAX_S", 90); },                // pausa máxima entre envíos
};

// Mensaje base de la promo (por si no hay IA disponible): clase de prueba $18.000
// (antes $25.000), invita a agendar, con el nombre del apoderado/niño si se conoce.
export function mensajeSeguimientoFallback(nombre?: string | null, alumno?: string | null): string {
  const hola = nombre ? `Hola ${nombre}` : "Hola";
  const aNino = alumno ? ` a ${alumno}` : "";
  return `${hola} 🎨 Soy Mary, de la academia de arte Arteluk. Me encantaría invitar${aNino} a nuestra clase de prueba. Tenemos una promoción: la clase de prueba queda en $18.000 (antes $25.000). ¿Te gustaría que agendemos un día para que venga a probar? — Mary, Arteluk`;
}

// Redacta el mensaje personalizado con IA. Cae al template si no hay key o si falla,
// de modo que la campaña NUNCA se queda sin mensaje que mandar.
export async function redactarSeguimiento(nombre?: string | null, alumno?: string | null): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return mensajeSeguimientoFallback(nombre, alumno);

  const system = `Eres Mary, dueña de la academia de arte Arteluk (Chile). Escribe UN mensaje de WhatsApp para invitar a un apoderado a una CLASE DE PRUEBA de arte.

Datos:
- Apoderado: ${nombre || "(no lo sabes)"}
- Niño/a: ${alumno || "(no lo sabes)"}
- Promoción: la clase de prueba queda en $18.000 (antes $25.000).
- Objetivo: que agenden un día para la clase de prueba.

Reglas: español chileno con tuteo (nunca "vos/podés/decís"); CÁLIDO, cercano y CORTO (2-3 frases); saluda por su nombre si lo tienes y menciona al niño/a si lo tienes; incluye la promo ($18.000 antes $25.000) e invita a AGENDAR; 1-2 emojis suaves como mucho; SIN exagerar ni prometer de más. Devuelve SOLO el mensaje final, sin comillas ni explicaciones ni opciones.`;

  // Timeout duro: si Anthropic se cuelga, no dejar el tick (y con él toda la campaña)
  // esperando indefinidamente. Se cae al template.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 250, system, messages: [{ role: "user", content: "Escribe el mensaje." }] }),
      signal: ctrl.signal,
    });
    if (!res.ok) return mensajeSeguimientoFallback(nombre, alumno);
    const data = (await res.json()) as { content?: { text?: string }[] };
    const msg = (data.content?.[0]?.text ?? "").trim();
    return msg || mensajeSeguimientoFallback(nombre, alumno);
  } catch {
    return mensajeSeguimientoFallback(nombre, alumno);
  } finally {
    clearTimeout(t);
  }
}
