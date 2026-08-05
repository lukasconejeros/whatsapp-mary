// Lógica pura para convertir lo que el modelo VE en una foto en un BORRADOR de ingreso.
// Sin red ni base de datos: entra el texto crudo del modelo, sale el borrador o null.
//
// Decisión de Lukas (05-08-2026): un comprobante NUNCA entra solo a Ingresos. Se propone
// y Mary lo aprueba de un toque. Él ya lo intentó una vez automático y "se iba cualquier
// cosa", así que aquí la regla de oro es: ante la duda, no proponer nada (devolver null).
// Un falso positivo le ensucia las cifras del negocio; un falso negativo solo le da trabajo.

/** Montos que Lukas nombró como propios de Arteluk (clase de prueba y mensualidades). */
export const MONTOS_ESPERADOS = [19990, 20000, 60000, 75000, 120000];

/** Techo de cordura: una academia de arte no recibe transferencias sobre esto. */
const MONTO_MAX = 5_000_000;

/** Cuántos días hacia atrás se acepta la fecha impresa en el comprobante. */
const DIAS_ATRAS_OK = 120;

export interface BorradorComprobante {
  monto: number;
  fecha: string; // YYYY-MM-DD
  nombre: string | null;
  banco: string | null;
  /** El monto coincide con uno de los de la academia (pinta el borrador como fiable). */
  esperado: boolean;
}

/**
 * Monto en pesos chilenos a partir de lo que devuelva el modelo. Acepta entero o texto
 * con "$", "CLP", puntos de miles y coma decimal. Devuelve null si no hay cifra creíble.
 */
export function normalizarMonto(v: string | number | null | undefined): number | null {
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    // Solo dígitos, puntos y comas; la coma abre los decimales chilenos y se corta ahí.
    const limpio = v.replace(/[^\d.,]/g, "").split(",")[0].replace(/\./g, "");
    if (!limpio) return null;
    n = parseInt(limpio, 10);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  n = Math.round(n);
  if (n <= 0 || n > MONTO_MAX) return null;
  return n;
}

export function esMontoEsperado(monto: number): boolean {
  return MONTOS_ESPERADOS.includes(monto);
}

/** Fecha YYYY-MM-DD creíble: bien formada, no futura y no más vieja que DIAS_ATRAS_OK. */
function fechaCreible(fecha: unknown, hoy: string): string | null {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) return null;
  const f = fecha.trim();
  // Mediodía para que el huso horario no corra el día.
  const t = new Date(`${f}T12:00:00Z`).getTime();
  if (!Number.isFinite(t)) return null;
  const hoyT = new Date(`${hoy}T12:00:00Z`).getTime();
  const dias = Math.round((hoyT - t) / 86_400_000);
  if (dias < 0 || dias > DIAS_ATRAS_OK) return null;
  return f;
}

/** El modelo suele envolver el JSON en prosa o en ```json```: se rescata el bloque. */
function extraerJSON(raw: string): Record<string, unknown> | null {
  const i = raw.indexOf("{");
  const j = raw.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try {
    const obj = JSON.parse(raw.slice(i, j + 1));
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Borrador de ingreso a partir de la respuesta cruda del modelo, o null si no hay que
 * proponer nada (no es comprobante, no se lee el monto, o la respuesta vino rota).
 */
export function interpretarComprobante(raw: string, hoy: string): BorradorComprobante | null {
  if (!raw?.trim()) return null;
  const obj = extraerJSON(raw);
  if (!obj) return null;
  if (obj.es_comprobante !== true) return null;

  const monto = normalizarMonto(obj.monto as string | number | null);
  if (monto === null) return null;

  return {
    monto,
    fecha: fechaCreible(obj.fecha, hoy) ?? hoy,
    nombre: texto(obj.nombre),
    banco: texto(obj.banco),
    esperado: esMontoEsperado(monto),
  };
}
