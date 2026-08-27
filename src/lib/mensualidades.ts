// El PASO 4 del CRM: en qué va la mensualidad de cada alumno, mes a mes.
//
// Lógica pura, sin base de datos ni reloj: el "hoy" entra por parámetro. Un estado
// que mirara la hora por dentro no se podría probar y cambiaría de respuesta solo,
// que es justo el error de contar sin decir de qué ventana de tiempo se habla.
//
// La regla del plazo NO la inventamos: está escrita en el cerebro del bot
// (prompts/negocio.md) — "Los pagos son mensuales y se hacen dentro de los primeros
// 10 días de cada mes, exclusivamente por transferencia electrónica".
//
// 🔑 Lo que no se puede mezclar:
//   · alumnos.mensualidad → su plan, lo que se le cobra SIEMPRE.
//   · una fila de 'mensualidades' → lo que pasó con UN mes concreto.
//   · una ausencia de tipo mes → Mary avisó que ese mes no viene ⇒ NO se le cobra.
// Cobrarle a quien avisó que no venía sería inventarle una deuda a una familia.

/** El plazo del negocio: hasta el día 10 no hay atraso. */
export const DIA_LIMITE_PAGO = 10;

export type EstadoPago =
  | "pagado"     // pagó todo lo del mes
  | "parcial"    // abonó una parte
  | "pendiente"  // no ha pagado y todavía está en plazo (o el mes no empieza)
  | "atrasado"   // pasó el día 10 y no hay nada pagado
  | "no_cobra"   // avisó que ese mes no viene
  | "sin_monto"; // no sabemos cuánto se le cobra (mensualidad en 0)

/** Una fila de la tabla 'mensualidades' (sin el id, que aquí no hace falta). */
export interface FilaMensualidad {
  alumno_id: number;
  mes: string;              // 'YYYY-MM'
  monto: number;            // lo que se le cobró ESE mes
  pagado: number;           // lo que lleva pagado
  estado: "pendiente" | "pagado";
  fecha: string | null;     // 'YYYY-MM-DD' del pago
  comprobante_id: number | null;
  ingreso_id: number | null;
  nota: string | null;
}

export interface PagoDelMes {
  estado: EstadoPago;
  /** Lo que hay que cobrarle ese mes (0 si no se le cobra). */
  monto: number;
  pagado: number;
  /** Lo que queda por cobrar, nunca negativo. */
  falta: number;
  fecha: string | null;
  comprobanteId: number | null;
  ingresoId: number | null;
  nota: string | null;
}

/** ¿Ya se pasó el plazo de ese mes a la fecha 'hoy'? Fechas ISO, se comparan como texto. */
export function plazoVencido(mes: string, hoy: string): boolean {
  return hoy > `${mes}-${String(DIA_LIMITE_PAGO).padStart(2, "0")}`;
}

/**
 * El estado de la mensualidad de UN alumno en UN mes.
 *
 * El orden de las reglas importa y es este:
 *   1. Si pagó, pagó — aunque después avisara que no viene (su plata no se borra).
 *   2. Si avisó que no viene ese mes, no se le cobra nada.
 *   3. Sin monto cargado no se puede cobrar, así que tampoco puede estar atrasado.
 */
export function estadoDelMes(args: {
  mes: string;
  hoy: string;
  mensualidadBase: number;
  fila: FilaMensualidad | null;
  noVieneEsteMes: boolean;
}): PagoDelMes {
  const { mes, hoy, mensualidadBase, fila, noVieneEsteMes } = args;
  const pagado = Math.max(0, Math.round(fila?.pagado ?? 0));
  // El monto del mes manda sobre el plan: si Mary le cobró otra cosa ese mes, vale esa.
  const monto = Math.max(0, Math.round(fila?.monto ?? mensualidadBase ?? 0));
  const base = {
    pagado,
    fecha: fila?.fecha ?? null,
    comprobanteId: fila?.comprobante_id ?? null,
    ingresoId: fila?.ingreso_id ?? null,
    nota: fila?.nota ?? null,
  };

  // 1. Pagado, y punto.
  if (fila?.estado === "pagado" || (monto > 0 && pagado >= monto)) {
    return { ...base, estado: "pagado", monto, falta: 0 };
  }
  // 2. Avisó que ese mes no viene: no se le cobra.
  if (noVieneEsteMes) {
    return { ...base, estado: "no_cobra", monto: 0, falta: 0 };
  }
  // 3. No sabemos cuánto se le cobra.
  if (monto <= 0) {
    return { ...base, estado: "sin_monto", monto: 0, falta: 0 };
  }

  const falta = Math.max(0, monto - pagado);
  if (pagado > 0) return { ...base, estado: "parcial", monto, falta };
  return { ...base, estado: plazoVencido(mes, hoy) ? "atrasado" : "pendiente", monto, falta };
}

/** Lo que Mary mira de una arriba de la pestaña Alumnos. */
export interface ResumenPagos {
  /** Plata que YA entró ese mes. */
  cobrado: number;
  /** Lo que falta por cobrar de los que sí deben. */
  porCobrar: number;
  /** Cuántos alumnos deben algo (atrasados, a medias o todavía en plazo). */
  deben: number;
  /** Cuántos ya pagaron todo. */
  alDia: number;
  /** Cuántos no se cobran ese mes porque avisaron que no vienen. */
  noCobra: number;
  /** Cuántos no tienen mensualidad cargada: hay que preguntárselo a Mary. */
  sinMonto: number;
}

export function resumenDelMes(fichas: { pago: PagoDelMes }[]): ResumenPagos {
  const r: ResumenPagos = { cobrado: 0, porCobrar: 0, deben: 0, alDia: 0, noCobra: 0, sinMonto: 0 };
  for (const f of fichas) {
    r.cobrado += f.pago.pagado;
    switch (f.pago.estado) {
      case "pagado": r.alDia++; break;
      case "no_cobra": r.noCobra++; break;
      case "sin_monto": r.sinMonto++; break;
      default: r.deben++; r.porCobrar += f.pago.falta;
    }
  }
  return r;
}
