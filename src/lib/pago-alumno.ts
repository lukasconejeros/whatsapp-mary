// EL ENGANCHE: de quién es la transferencia que acaba de llegar (paso 4 del CRM).
//
// Lógica pura: entran el teléfono del chat, el monto, el nombre del titular y la lista
// de alumnos; sale una PROPUESTA. Sin base de datos y sin reloj, para poder probar de
// verdad el caso que importa: el pago cargado al hermano equivocado.
//
// Las señales, por fuerza (razonado con Lukas el 26-08-2026):
//   1. El TELÉFONO del chat de donde llegó la foto — exacto, acierta siempre.
//   2. El MONTO — desempata entre hermanos con mensualidades distintas.
//   3. El NOMBRE del titular — SOLO refuerzo: en Chile paga el papá, la abuela o un tío
//      con otro apellido, así que NUNCA elige solo; como mucho se ofrece.
//
// 🔑 Nada se marca solo (regla de esta app desde el 05-08-2026, y aquí pesa el doble:
// un pago mal cargado le inventa una deuda a una familia y le regala un mes a otra).
// Esto PROPONE; el botón lo aprieta Mary.

import { normalizeChilePhone } from "./phone";

export interface AlumnoParaPago {
  id: number;
  nombre: string;
  apoderado: string | null;
  /** El del apoderado, como está en la ficha. */
  telefono: string | null;
  /** Su plan: lo que se le cobra al mes (0 = todavía no se sabe). */
  mensualidad: number;
  activo: boolean;
  /** Ya tiene cubierta la mensualidad del mes al que iría este pago. */
  yaPagoElMes: boolean;
  /** Mary avisó que ese mes no viene. */
  noVieneEsteMes: boolean;
}

export interface CandidatoPago {
  /** Uno, o varios cuando la transferencia paga a los hermanos de una sola vez. */
  alumnoIds: number[];
  etiqueta: string;
  /** Por qué se propone, escrito para que Mary lo entienda de una. */
  razon: string;
  /** Lo que ella tiene que ver ANTES de apretar (ya pagó, no viene, el monto no calza). */
  avisos: string[];
}

export interface Emparejamiento {
  /** Todos los que podrían ser, el más probable primero. */
  candidatos: CandidatoPago[];
  /** El que viene preseleccionado, o null cuando hay que elegir a mano. */
  elegido: CandidatoPago | null;
  /** El mes que se propone marcar ('YYYY-MM'), o null si la fecha no sirve. */
  mes: string | null;
}

/** $60.000, como lo escribe cualquiera. */
function plata(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

/** Palabras útiles de un nombre: sin tildes, en minúsculas y de 4 letras para arriba. */
function palabras(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 4);
}

/** ¿El titular del comprobante y este alumno comparten algún nombre o apellido? */
function calzaNombre(titular: string | null, a: AlumnoParaPago): boolean {
  const t = palabras(titular);
  if (t.length === 0) return false;
  const suyas = new Set([...palabras(a.apoderado), ...palabras(a.nombre)]);
  return t.some((p) => suyas.has(p));
}

function avisosDe(a: AlumnoParaPago, monto: number): string[] {
  const avisos: string[] = [];
  if (a.yaPagoElMes) avisos.push("ya pagó su mensualidad de este mes");
  if (a.noVieneEsteMes) avisos.push("avisó que este mes no viene");
  if (a.mensualidad <= 0) avisos.push("no tiene mensualidad cargada en su ficha");
  else if (a.mensualidad !== monto) avisos.push(`el monto no es su mensualidad (${plata(a.mensualidad)})`);
  return avisos;
}

/** El mes al que se imputa: el de la FECHA DEL PAGO, no el de hoy. */
function mesDe(fecha: string | null | undefined): string | null {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) return null;
  return fecha.trim().slice(0, 7);
}

/**
 * Cómo se parte UNA transferencia entre los alumnos a los que Mary se la carga.
 *
 * Si el monto es justo la suma de sus mensualidades (el papá pagó a los dos hijos de
 * una vez), a cada uno LO SUYO — repartir la mitad y la mitad dejaría al de la
 * mensualidad más cara debiendo plata que sí pagó. En cualquier otro caso, partes
 * iguales, y el peso que no se puede partir se lo lleva el primero.
 */
export function repartirMonto(monto: number, mensualidades: number[]): number[] {
  const n = mensualidades.length;
  if (n === 0) return [];
  const total = Math.max(0, Math.round(monto));
  const suma = mensualidades.reduce((s, m) => s + m, 0);
  if (suma === total && mensualidades.every((m) => m > 0)) return mensualidades.map((m) => Math.round(m));

  const base = Math.floor(total / n);
  const partes = new Array(n).fill(base);
  partes[0] += total - base * n;
  return partes;
}

/**
 * La propuesta de a quién cargarle esta transferencia.
 *
 * Devuelve `elegido` SOLO cuando la señal es fuerte de verdad:
 *   · el teléfono es de una sola familia Y el monto no deja dudas, o
 *   · queda un solo alumno de esa casa que pueda recibirlo.
 * En cuanto hay dos lecturas posibles, `elegido` es null y elige Mary.
 */
export function emparejarPago(args: {
  telefono: string | null;
  monto: number;
  nombreTitular: string | null;
  fecha: string | null;
  alumnos: AlumnoParaPago[];
}): Emparejamiento {
  const { monto, nombreTitular, fecha } = args;
  const mes = mesDe(fecha);
  const activos = args.alumnos.filter((a) => a.activo);

  const tel = normalizeChilePhone(args.telefono);
  const familia = tel ? activos.filter((a) => normalizeChilePhone(a.telefono) === tel) : [];

  const unoSolo = (a: AlumnoParaPago, razon: string): CandidatoPago => ({
    alumnoIds: [a.id], etiqueta: a.nombre, razon, avisos: avisosDe(a, monto),
  });

  // ── 1. La casa que calza por teléfono ───────────────────────────────────────
  if (familia.length > 0) {
    const candidatos: CandidatoPago[] = [];
    let elegido: CandidatoPago | null = null;

    // ¿Una sola transferencia por los hermanos? Solo si la suma cuadra EXACTA.
    const suma = familia.reduce((s, a) => s + a.mensualidad, 0);
    if (familia.length >= 2 && suma > 0 && suma === monto && familia.every((a) => a.mensualidad > 0)) {
      const grupo: CandidatoPago = {
        alumnoIds: familia.map((a) => a.id),
        etiqueta: familia.map((a) => a.nombre).join(" y "),
        razon: `el monto es justo la suma de las mensualidades de las ${familia.length} alumnas de este teléfono`,
        avisos: familia.filter((a) => a.yaPagoElMes).map((a) => `${a.nombre} ya pagó este mes`),
      };
      candidatos.push(grupo);
      elegido = grupo;
    }

    // Los que HOY pueden recibir el pago: los otros ya pagaron o no vienen.
    const pueden = familia.filter((a) => !a.yaPagoElMes && !a.noVieneEsteMes);
    const calzanMonto = pueden.filter((a) => a.mensualidad === monto && a.mensualidad > 0);

    let solo: AlumnoParaPago | null = null;
    if (calzanMonto.length === 1) solo = calzanMonto[0];
    else if (calzanMonto.length === 0 && pueden.length === 1) solo = pueden[0];

    for (const a of familia) {
      const suyo = a.id === solo?.id;
      const razon = suyo && a.mensualidad === monto && a.mensualidad > 0
        ? "el chat es de su teléfono y el monto calza con su mensualidad"
        : "el chat es de su teléfono";
      const c = unoSolo(a, razon);
      candidatos.push(c);
      if (suyo && !elegido) elegido = c;
    }

    // El preseleccionado primero; los que ya pagaron o no vienen, al final.
    const peso = (c: CandidatoPago) => (c === elegido ? 0 : c.avisos.length > 0 ? 2 : 1);
    candidatos.sort((x, y) => peso(x) - peso(y));
    return { candidatos, elegido, mes };
  }

  // ── 2. Sin teléfono que calce: el nombre, y solo como sugerencia ────────────
  const porNombre = activos.filter((a) => calzaNombre(nombreTitular, a));
  const candidatos = porNombre.map((a) =>
    unoSolo(a, "el nombre del titular se parece al de su apoderado, pero eso solo no basta")
  );
  return { candidatos, elegido: null, mes };
}
