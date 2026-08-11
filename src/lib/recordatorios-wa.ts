// Lógica pura de los RECORDATORIOS que Mary crea en el formulario del
// calendario: decide cuáles hay que mandarle por WhatsApp en este instante.
// Sin I/O ni reloj propio (entran "hoy" y "ahora" por parámetro) para poder
// probar cualquier hora del día.
//
// Decisión de Lukas (10-08-2026): estos van por WHATSAPP A SU PROPIO NÚMERO
// —el mismo del bot, o sea el chat consigo misma—, NUNCA a un apoderado.
// Los otros dos avisos del calendario (el resumen de las 20:00 y el de 5 h
// antes de cada clase) siguen saliendo como Web Push: no se tocan.
//
// A diferencia de esos, aquí la hora la eligió ELLA al crear el recordatorio,
// así que se manda A esa hora, no antes, y se respeta aunque caiga de noche.
import { minutosDe, diasEntre } from "./recordatorios.js";

/** Los sin hora salen a media mañana, no de madrugada. */
export const HORA_SIN_HORA = 9;

/**
 * Cuánto se tolera llegar tarde. Cubre que el bot estuviera caído un rato;
 * más allá el aviso ya no sirve y sería ruido a deshora.
 */
export const GRACIA_MIN = 180;

export interface FilaRecordatorio {
  id: number;
  fecha: string; // YYYY-MM-DD
  hora: string | null; // HH:MM
  texto: string;
  avisar: boolean;
  enviadoAt: number | null; // epoch en segundos: ya salió de verdad
  hecho: boolean;
  /** Ya encolado en el outbox, esperando a que WhatsApp lo despache. */
  outboxId: number | null;
}

export interface AvisoRecordatorio {
  id: number;
  mensaje: string;
}

/** El texto tal cual le llega a Mary. */
export function mensajeDe(f: FilaRecordatorio): string {
  return `⏰ Recordatorio: ${f.texto.trim()}`;
}

/**
 * Qué recordatorios toca mandar ahora mismo.
 *
 * @param hoy   YYYY-MM-DD en Santiago
 * @param ahora HH:MM en Santiago
 */
export function recordatoriosPorMandar(
  filas: FilaRecordatorio[],
  hoy: string,
  ahora: string
): AvisoRecordatorio[] {
  const ahoraMin = minutosDe(ahora);
  if (ahoraMin === null) return [];

  return filas
    .filter((f) => f.avisar && !f.hecho && f.enviadoAt === null && f.outboxId === null)
    .filter((f) => diasEntre(hoy, f.fecha) === 0) // solo los de hoy
    .map((f) => ({ f, min: minutosDe(f.hora) ?? HORA_SIN_HORA * 60 }))
    .filter(({ min }) => {
      const atraso = ahoraMin - min;
      return atraso >= 0 && atraso <= GRACIA_MIN;
    })
    .sort((a, b) => a.min - b.min || a.f.id - b.f.id)
    .map(({ f }) => ({ id: f.id, mensaje: mensajeDe(f) }));
}
