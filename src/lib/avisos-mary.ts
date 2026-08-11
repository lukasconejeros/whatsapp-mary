// Los dos avisos fijos que Mary recibe en su propio WhatsApp (Lukas, 11-08-2026):
// el de las 10:00 con todo lo del día, y el pase de lista de las 21:00.
//
// Todo puro: la hora entra por parámetro y aquí solo se decide "toca o no toca"
// y se redacta el texto. Quien toca la base y la cola es avisos-mary-loop.ts.
//
// Estos dos SUSTITUYEN a los avisos por notificación que había antes (el resumen
// de la víspera a las 20:00 y el de 5 h antes de cada clase), que quedaron
// apagados con AVISOS_PUSH_ACTIVOS en recordatorios.ts.
import { minutosDe } from "./recordatorios.js";
import { DIA_LABEL, diaFromFecha } from "./calendario.js";
import type { ItemDia } from "./dia-de-mary.js";

export type TipoAviso = "resumen" | "pase-lista";

/** Todo lo del día, a media mañana: ya está despierta y aún puede reaccionar. */
export const HORA_RESUMEN_DIA = 10;
/** El pase de lista, cuando ya terminaron las clases. */
export const HORA_PASE_LISTA = 21;

/**
 * Cuánto se tolera llegar tarde, en minutos. Cubre que el bot estuviera caído;
 * más allá el aviso ya no sirve y sería ruido a deshora.
 */
export const GRACIA_MIN = 180;

export function horaDe(tipo: TipoAviso): number {
  return tipo === "resumen" ? HORA_RESUMEN_DIA : HORA_PASE_LISTA;
}

/** @param ahora "HH:MM" en Santiago. */
export function tocaAviso(tipo: TipoAviso, ahora: string): boolean {
  const ahoraMin = minutosDe(ahora);
  if (ahoraMin === null) return false;
  const atraso = ahoraMin - horaDe(tipo) * 60;
  return atraso >= 0 && atraso <= GRACIA_MIN;
}

/** "Mateo, Matilda y Sofía" — como lo diría ella, no como una lista de sistema. */
export function enumerar(nombres: string[]): string {
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** "martes 11" */
function diaYNumero(fecha: string): string {
  const dia = DIA_LABEL[diaFromFecha(fecha)] ?? "";
  const numero = parseInt(fecha.slice(8, 10), 10);
  return `${dia.toLowerCase()} ${numero}`;
}

/** El mensaje de las 10:00. Cada cosa en una línea, en el orden que ya trae. */
export function textoResumen(fecha: string, items: ItemDia[]): string {
  const lineas = items.map((i) => {
    const hora = i.hora ? `${i.hora} ` : "";
    if (i.tipo === "recordatorio") return `⏰ ${hora}${i.texto}`;
    if (i.tipo === "pago") return `💸 ${hora}${i.texto}`;
    return `${hora}${i.texto}`.trim();
  });
  return [`☀️ Hoy ${diaYNumero(fecha)}`, ...lineas].join("\n");
}

/** El mensaje de las 21:00. */
export function textoPaseLista(alumnos: string[]): string {
  if (alumnos.length === 1) {
    return `📋 Hoy tenías a ${alumnos[0]}.\n¿Vino? Si no vino, dímelo.`;
  }
  return `📋 Hoy tenías a ${enumerar(alumnos)}.\n¿Vinieron todos? Si faltó alguien dime su nombre.`;
}

/** Lo que le contesta cuando entendió. */
export function textoConfirmacion(vino: string[], falto: string[]): string {
  if (falto.length === 0) return "👌 Anotado: vinieron todos.";
  if (vino.length === 0) return "👌 Anotado: no vino nadie.";
  const verbo = falto.length === 1 ? "faltó" : "faltaron";
  return `👌 Anotado: ${verbo} ${enumerar(falto)}.`;
}

/** Cuando no entendió. Se pide UNA vez; no se insiste más. */
export function textoNoEntendi(): string {
  return "Perdona, no te entendí 🙈 Dime solo los nombres de los que faltaron, o escribe «todos» si vinieron todos.";
}

/** Cuando tampoco entendió la segunda: se calla y le deja el camino a mano. */
export function textoMeRindo(): string {
  return "No te preocupes, lo dejamos así. Si quieres marcarlo, tócalo en el calendario de la app.";
}
