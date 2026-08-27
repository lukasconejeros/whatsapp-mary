// La vista que alimenta la pestaña Alumnos: UNA TARJETA POR ALUMNO, del mes que Mary
// esté mirando (Lukas, 26-08-2026).
//
// Vive aquí y no dentro de la pantalla para poder probarla sin navegador, que es como
// se caza a tiempo el error de siempre: un contador sin ventana de tiempo. Las faltas
// de julio no pueden aparecer cuando se mira agosto.
//
// Las faltas NO se piden a nadie: ya las deja el pase de lista de las 21:00 en la
// tabla 'asistencia', y Mary las puede corregir a mano desde el calendario.

import {
  listAlumnos, listInscripciones, asistenciaRango,
  ausenciasDeMes, ausenciasDiaDeMes, listMensualidadesDeMes, type Inscripcion,
} from "./db";
import { estadoDelMes, type PagoDelMes } from "./mensualidades";
import { todaySantiago } from "./fechas";

export interface FichaAlumno {
  id: number;
  nombre: string;
  apoderado: string | null;
  telefono: string | null;
  mensualidad: number;
  notas: string | null;
  /** La duda de la planilla que sigue sin resolver con Mary, o null. */
  revisar: string | null;
  inscripciones: Inscripcion[];
  /** Los días que faltó ESE mes ('YYYY-MM-DD'): cada uno da derecho a una recuperativa. */
  faltas: string[];
  /** Cuántos días vino ese mes. */
  vino: number;
  /** Los días de ese mes que Mary avisó ANTES que no venía. También dan recuperativa. */
  avisadas: string[];
  /** Faltas + días avisados: las clases recuperativas a las que puede optar ese mes. */
  recuperativas: number;
  /** Mary avisó que no viene en TODO este mes ("que se salga del CRM solo ese mes"). */
  noVieneEsteMes: boolean;
  /** El id de ese aviso de mes, para deshacerlo con un toque. */
  ausenciaMesId: number | null;
  motivoMes: string | null;
  /** Cómo va su mensualidad ESE mes (paso 4). Quien avisó que no viene, no debe nada. */
  pago: PagoDelMes;
}

// De lunes a sábado, que es como Mary lee su planilla. Sin día = al final del todo.
const ORDEN_DIA: Record<string, number> = {
  Lunes: 1, Martes: 2, Miercoles: 3, Jueves: 4, Viernes: 5, Sabado: 6, Domingo: 7,
};
function pesoDia(d: string | null): number {
  return d ? (ORDEN_DIA[d] ?? 8) : 9;
}

/** El último día del mes 'YYYY-MM', sin depender de la zona horaria. */
function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mes}-${String(ultimo).padStart(2, "0")}`;
}

/**
 * Las tarjetas del CRM para un mes ('YYYY-MM'), ordenadas por el día en que viene
 * cada alumno y su hora, para que se lean igual que el calendario. Solo alumnos
 * activos: los dados de baja no ensucian el mes, pero siguen en la base.
 */
export function fichasDelMes(mes: string, hoy: string = todaySantiago()): FichaAlumno[] {
  const pagos = new Map(listMensualidadesDeMes(mes).map((m) => [m.alumno_id, m]));
  const asistencia = asistenciaRango(`${mes}-01`, finDeMes(mes));
  const faltasPorNombre = new Map<string, string[]>();
  const vinoPorNombre = new Map<string, number>();
  for (const a of asistencia) {
    if (a.estado === "falto") {
      const l = faltasPorNombre.get(a.alumno) ?? [];
      l.push(a.fecha);
      faltasPorNombre.set(a.alumno, l);
    } else {
      vinoPorNombre.set(a.alumno, (vinoPorNombre.get(a.alumno) ?? 0) + 1);
    }
  }

  // Los avisos del botón "no viene", que son de ESTE mes y de nadie más: el de
  // agosto no puede pintar septiembre.
  const mesFuera = new Map(ausenciasDeMes(mes).map((x) => [x.alumnoId, x]));
  const diasAvisados = new Map<number, string[]>();
  for (const x of ausenciasDiaDeMes(mes)) {
    if (!x.fecha) continue;
    diasAvisados.set(x.alumnoId, [...(diasAvisados.get(x.alumnoId) ?? []), x.fecha]);
  }

  const fichas: FichaAlumno[] = [];
  for (const a of listAlumnos()) {
    if (!a.activo) continue;
    const inscripciones = listInscripciones(a.id)
      .filter((i) => i.activa)
      .sort((x, y) => pesoDia(x.dia) - pesoDia(y.dia) || x.hora.localeCompare(y.hora));
    const faltas = (faltasPorNombre.get(a.nombre) ?? []).sort();
    const avisadas = (diasAvisados.get(a.id) ?? []).sort();
    const fuera = mesFuera.get(a.id) ?? null;
    fichas.push({
      id: a.id, nombre: a.nombre, apoderado: a.apoderado, telefono: a.telefono,
      mensualidad: a.mensualidad, notas: a.notas, revisar: a.revisar,
      inscripciones,
      faltas,
      vino: vinoPorNombre.get(a.nombre) ?? 0,
      avisadas,
      // Faltar un día —lo haya avisado o no— da derecho a una clase recuperativa
      // (Lukas, 26-08: "quien falta un día puede optar a una clase recuperatoria").
      recuperativas: faltas.length + avisadas.length,
      noVieneEsteMes: fuera !== null,
      ausenciaMesId: fuera?.id ?? null,
      motivoMes: fuera?.motivo ?? null,
      pago: estadoDelMes({
        mes, hoy, mensualidadBase: a.mensualidad,
        fila: pagos.get(a.id) ?? null,
        noVieneEsteMes: fuera !== null,
      }),
    });
  }

  return fichas.sort((x, y) => {
    const dx = x.inscripciones[0], dy = y.inscripciones[0];
    return pesoDia(dx?.dia ?? null) - pesoDia(dy?.dia ?? null)
      || (dx?.hora ?? "").localeCompare(dy?.hora ?? "")
      || x.nombre.localeCompare(y.nombre, "es");
  });
}
