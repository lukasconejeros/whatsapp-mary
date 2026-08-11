// Lógica pura de los recordatorios del calendario de Arteluk: decide QUÉ hay
// que avisarle a Mary en este instante. Sin I/O ni reloj propio (entran "hoy" y
// "ahora" por parámetro) para poder probar cualquier hora del día.
//
// Regla acordada con Lukas (04-08-2026), pensada para NO inundar el teléfono:
//   1. Un RESUMEN la víspera a las 20:00 con todo lo que hay al día siguiente.
//   2. Un aviso 5 h antes de cada horario, AGRUPANDO lo que empieza a la misma
//      hora (cuatro alumnos a las 18:00 son un aviso, no cuatro).
//
// El calendario no es solo clases: si la fila no tiene alumnos se usa su nota,
// así las anotaciones sueltas de Mary avisan igual.
//
// IDEMPOTENCIA: el aviso de 5 h se marca en la propia fila (columna aviso_5h);
// el resumen, por fecha, fuera de aquí. Sin eso, un loop que corre cada 5
// minutos mandaría el mismo push durante toda la ventana.

/**
 * APAGADOS el 11-08-2026 por encargo de Lukas: los sustituyen los dos avisos
 * por WhatsApp de `avisos-mary.ts` (el resumen del día a las 10:00 y el pase de
 * lista a las 21:00). Con los cuatro encendidos a la vez le llenábamos el
 * teléfono, así que el resumen de la víspera y el de "5 h antes" se callan.
 *
 * El código y sus pruebas se dejan enteros a propósito: si los quiere de vuelta,
 * es cambiar este false y nada más. El apagado real está en el loop
 * (`tickRecordatorios`), no aquí, para que las pruebas de esta lógica sigan
 * valiendo y documentando cómo se comportaban.
 */
export const AVISOS_PUSH_ACTIVOS = false;

export type ClaseAviso = "resumen" | "5h";

/** Antelación del aviso previo a cada horario, en minutos. */
export const MIN_5H = 300;
/** Un día en minutos. */
export const MIN_DIA = 1440;

/** Franja de silencio: de 23:00 a 07:00 no se manda nada. */
export const SILENCIO_DESDE = 23;
export const SILENCIO_HASTA = 7;

/** Hora a la que sale el resumen de lo que hay mañana. */
export const HORA_RESUMEN = 20;

export interface FilaCalendario {
  id: number;
  fecha: string; // YYYY-MM-DD
  hora: string | null; // HH:MM
  profe: string;
  alumnos: string[];
  nota: string | null;
  aviso_5h: number; // 0/1 — ya se envió
}

export interface Recordatorio {
  clase: ClaseAviso;
  titulo: string;
  cuerpo: string;
  url: string;
  tag: string;
  /** Filas que cubre este aviso (para marcarlas de una vez). */
  filas: number[];
  /** Solo en el resumen: el día que resume, para no repetirlo. */
  fechaResumen?: string;
}

/** Minutos desde medianoche de un "HH:MM". Formato inválido → null. */
export function minutosDe(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Días enteros entre dos fechas YYYY-MM-DD (b - a). Mediodía para esquivar husos. */
export function diasEntre(a: string, b: string): number {
  const ms = new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function enSilencio(horaActual: number): boolean {
  return horaActual >= SILENCIO_DESDE || horaActual < SILENCIO_HASTA;
}

/** Minutos que faltan para la fila. Sin hora → null. Negativo = ya pasó. */
export function minutosHasta(f: FilaCalendario, hoy: string, ahora: string): number | null {
  const min = minutosDe(f.hora);
  if (min === null) return null;
  const ahoraMin = minutosDe(ahora);
  if (ahoraMin === null) return null;
  return diasEntre(hoy, f.fecha) * MIN_DIA + (min - ahoraMin);
}

function textoFaltan(minutos: number): string {
  if (minutos < 60) return `en ${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
}

/** Cómo se nombra una fila: los alumnos si es clase, la nota si es una anotación. */
function describir(f: FilaCalendario): string {
  const alumnos = f.alumnos.filter(Boolean);
  if (alumnos.length) return `${f.profe} · ${alumnos.join(", ")}`;
  if (f.nota) return f.nota;
  return f.profe;
}

/** Igual pero para el resumen, donde cada línea ya lleva la hora delante. */
function describirCorto(f: FilaCalendario): string {
  const alumnos = f.alumnos.filter(Boolean);
  if (alumnos.length) return `${f.profe} (${alumnos.length})`;
  if (f.nota) return f.nota;
  return f.profe;
}

/**
 * Qué avisos corresponde mandar ahora mismo.
 *
 * @param resumenEnviado fechas cuyo resumen de víspera YA salió.
 */
export function recordatoriosPendientes(
  filas: FilaCalendario[],
  hoy: string,
  ahora: string, // HH:MM
  resumenEnviado: Set<string> = new Set()
): Recordatorio[] {
  const horaActual = Math.floor((minutosDe(ahora) ?? 0) / 60);
  if (enSilencio(horaActual)) return [];

  const salida: Recordatorio[] = [];

  // ── 1. Resumen de la víspera ────────────────────────────────────────────
  if (horaActual >= HORA_RESUMEN) {
    const manana = filas.filter((f) => diasEntre(hoy, f.fecha) === 1);
    if (manana.length) {
      const fechaManana = manana[0].fecha;
      if (!resumenEnviado.has(fechaManana)) {
        const ordenadas = [...manana].sort(
          (a, b) => (minutosDe(a.hora) ?? 9999) - (minutosDe(b.hora) ?? 9999)
        );
        const lineas = ordenadas.map((f) =>
          f.hora ? `${f.hora} ${describirCorto(f)}` : describirCorto(f)
        );
        salida.push({
          clase: "resumen",
          titulo: `Mañana tienes ${manana.length} ${manana.length === 1 ? "cosa agendada" : "cosas agendadas"}`,
          cuerpo: lineas.join(" · "),
          url: "/calendario",
          tag: `resumen-${fechaManana}`,
          filas: ordenadas.map((f) => f.id),
          fechaResumen: fechaManana,
        });
      }
    }
  }

  // ── 2. Aviso 5 h antes, agrupado por hora de inicio ─────────────────────
  const porHora = new Map<string, { falta: number; filas: FilaCalendario[] }>();
  for (const f of filas) {
    if (f.aviso_5h) continue;
    const faltan = minutosHasta(f, hoy, ahora);
    if (faltan === null) continue; // sin hora: solo entra en el resumen
    if (faltan <= 0) continue; // ya empezó: avisar ahora sería ruido
    if (faltan > MIN_5H) continue;
    const clave = f.hora as string;
    const grupo = porHora.get(clave) ?? { falta: faltan, filas: [] };
    grupo.filas.push(f);
    porHora.set(clave, grupo);
  }

  for (const [hora, grupo] of [...porHora.entries()].sort()) {
    const detalle = grupo.filas.map(describir).join(" · ");
    salida.push({
      clase: "5h",
      titulo: `Pronto: ${hora}`,
      cuerpo: `${detalle} (${textoFaltan(grupo.falta)})`,
      url: "/calendario",
      // Un tag por horario: el aviso de las 16:00 no pisa el de las 18:00.
      tag: `clase-${grupo.filas[0].fecha}-${hora}`,
      filas: grupo.filas.map((f) => f.id),
    });
  }

  return salida;
}
