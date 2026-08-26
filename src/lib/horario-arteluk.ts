// El horario REAL de la academia, transcrito de las 9 fotos del Excel de Mary que
// Lukas mandó el 26-08-2026: 6 días (lunes a sábado), 2 profesoras y 44 filas.
//
// Dos cosas que este archivo cuida por encima de todo:
//
// 1. FIDELIDAD. Cada fila de abajo es una fila de la planilla, con la hora de salida
//    que le corresponde a ESE alumno (dentro de la misma sala unos se van a las 18:30
//    y otros a las 19:30 — ese es el motivo del modelo alumnos/inscripciones).
// 2. NO INVENTAR. Donde la planilla es ambigua —un nombre que puede ser dos personas,
//    la foto que llegó sin encabezado, el bloque sin profesora— la fila queda MARCADA
//    en 'revisar' y sin apoderado. Son menores: pegarle el teléfono equivocado a una
//    ficha es escribirle al apoderado de otro niño.
//
// El apoderado y el teléfono NO se escriben aquí: salen de CONTACTOS_ARTELUK (la
// libreta que Mary ya entregó) y solo cuando la coincidencia es segura; para eso está
// el campo 'contacto', que guarda el nombre EXACTO del alumno en esa libreta.

import { CONTACTOS_ARTELUK } from "./seed-contactos";
import { addAlumno, addInscripcion, listAlumnos, listInscripciones } from "./db";

export interface FilaPlanilla {
  /** El nombre tal cual está escrito en la foto (a veces en minúsculas o en mayúsculas). */
  alumno: string;
  /** 'Lunes'…'Sabado' sin tilde. null = la foto llegó sin encabezado. */
  dia: string | null;
  hora: string;
  horaFin: string;
  /** 'Mary' (primera tabla) | 'Paula' (segunda) | null = no se sabe todavía. */
  profe: string | null;
  /** Lo que se lee en la planilla; 0 = la planilla no lo dice (no se inventa). */
  mensualidad?: number;
  /** Nombre EXACTO del alumno en CONTACTOS_ARTELUK, solo si la coincidencia es segura. */
  contacto?: string;
  /**
   * El nombre con el que esta fila se UNE a otra ficha. Lukas, 26-08-2026: en la
   * academia "nadie tiene nombres iguales", asi que la Julieta del sabado y la
   * Julieta Bratz del lunes son la misma nina viniendo dos dias. La fila conserva el
   * texto literal de la planilla en 'alumno' (fidelidad) y aqui va el nombre bueno.
   */
  mismaQue?: string;
  /** La duda que hay que preguntarle a Mary antes de dar la fila por buena. */
  revisar?: string;
  notas?: string;
  /** Fila repetida en la planilla: se cuenta, pero NO se carga otra vez. */
  duplicada?: boolean;
}

const SIN_LIBRETA = "no está en la libreta de apoderados: falta su teléfono";
// La foto 7 llegó sin encabezado. Lukas lo preguntó y respondió el 26-08-2026:
// es el JUEVES y la clase es con MARY (que ese día hace hasta las 19:30).

export const PLANILLA_AGOSTO_2026: FilaPlanilla[] = [
  // ── LUNES (fotos 1 y 2) ────────────────────────────────────────────────────
  { alumno: "Mateo", dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary", contacto: "Mateo Godoy Flores" },
  { alumno: "Matilda", dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary", contacto: "Matilda Eleonor Durán Muñoz" },
  { alumno: "Antonia Pontigo", dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary", contacto: "Antonia Pontigo" },
  { alumno: "Ignacia", dia: "Lunes", hora: "17:30", horaFin: "19:30", profe: "Mary", revisar: "hay dos en la libreta: Maria Ignacia Perez Ferron y Maria Ignacia Tauler Lira" },
  { alumno: "Julieta Bratz", dia: "Lunes", hora: "18:30", horaFin: "19:30", profe: "Paula", contacto: "Julieta Bratz" },
  { alumno: "Noah", dia: "Lunes", hora: "18:30", horaFin: "19:30", profe: "Paula", contacto: "Noah Campos Arteaga" },
  { alumno: "Alison", dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: "Paula", contacto: "Allison Ferrada Olivares" },
  { alumno: "Amelia", dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: "Paula", revisar: "¿es la Amelia Sepúlveda de Judith Higueras?" },
  { alumno: "Amparo", dia: "Lunes", hora: "16:00", horaFin: "17:00", profe: "Paula", revisar: "¿Amparo Sepúlveda (Judith Higueras) o Amparo Coronado (Genoveva Montero)?" },

  // ── MARTES (foto 3) ────────────────────────────────────────────────────────
  { alumno: "Mateo", dia: "Martes", hora: "17:30", horaFin: "19:30", profe: "Mary", mensualidad: 45000 },
  { alumno: "Aurora", dia: "Martes", hora: "17:30", horaFin: "18:30", profe: "Mary", mensualidad: 45000, revisar: SIN_LIBRETA, notas: "la planilla la marca PAGADO" },
  { alumno: "José Daniel", dia: "Martes", hora: "17:30", horaFin: "18:30", profe: "Mary", mensualidad: 45000, revisar: SIN_LIBRETA },

  // ── MIÉRCOLES (foto 4) ─────────────────────────────────────────────────────
  { alumno: "Rafaela Estay", dia: "Miercoles", hora: "17:30", horaFin: "19:30", profe: "Mary", revisar: SIN_LIBRETA },
  { alumno: "Maite Muñoz", dia: "Miercoles", hora: "17:30", horaFin: "19:30", profe: "Mary", contacto: "Maite Muñoz Bastidas" },
  { alumno: "Josefina Tomckowiack", dia: "Miercoles", hora: "17:30", horaFin: "19:30", profe: "Mary", contacto: "Josefina Tomckowiack" },
  { alumno: "Gabriela Martínez", dia: "Miercoles", hora: "17:30", horaFin: "19:30", profe: "Mary", contacto: "Gabriela Martínez Schmitz" },
  { alumno: "Valentina Roa", dia: "Miercoles", hora: "18:30", horaFin: "19:30", profe: "Paula", contacto: "Valentina Roa" },
  { alumno: "Sofía", dia: "Miercoles", hora: "18:30", horaFin: "19:30", profe: "Paula", mismaQue: "Sofía Llancaleo" },

  // ── JUEVES · primera tabla (foto 5) ────────────────────────────────────────
  { alumno: "Barbara", dia: "Jueves", hora: "17:30", horaFin: "19:30", profe: "Mary", revisar: SIN_LIBRETA },
  { alumno: "diego", dia: "Jueves", hora: "17:30", horaFin: "18:30", profe: "Mary", revisar: "hay tres Diego en la libreta: Diego (de Sergio), Diego Torres y Diego Montoya" },
  { alumno: "Amanda", dia: "Jueves", hora: "17:30", horaFin: "18:30", profe: "Mary", contacto: "Amanda Diaz" },
  { alumno: "Ema Niklitschek", dia: "Jueves", hora: "17:30", horaFin: "18:30", profe: "Mary", contacto: "Emma Niklitschek Santana" },
  { alumno: "francisca", dia: "Jueves", hora: "17:30", horaFin: "18:30", profe: "Mary", contacto: "Francisca Esperguel" },

  // ── JUEVES · PAULA (foto 6, la única rotulada con profesora) ───────────────
  { alumno: "Agustina", dia: "Jueves", hora: "16:00", horaFin: "18:00", profe: "Paula", mensualidad: 120000, contacto: "Agustina Decap" },
  { alumno: "elizabeth", dia: "Jueves", hora: "16:00", horaFin: "18:00", profe: "Paula", mensualidad: 100000, contacto: "Elizabeth Belén Arancibia Olivera" },
  { alumno: "amapola", dia: "Jueves", hora: "16:00", horaFin: "18:00", profe: "Paula", mensualidad: 120000, contacto: "Amapola" },
  { alumno: "Amelia Brellenthin", dia: "Jueves", hora: "17:00", horaFin: "18:00", profe: "Paula", mensualidad: 60000, revisar: `${SIN_LIBRETA}. ¿es la misma Amelia que viene el lunes a las 16:00?` },

  // ── FOTO 7 · llegó sin encabezado; el 26-08 Lukas confirmó JUEVES y con MARY ─
  { alumno: "PAULINA", dia: "Jueves", hora: "18:30", horaFin: "19:30", profe: "Mary", revisar: SIN_LIBRETA },
  { alumno: "Violeta", dia: "Jueves", hora: "18:30", horaFin: "19:30", profe: "Mary", contacto: "Violeta Sanhueza" },
  { alumno: "GRACE", dia: "Jueves", hora: "18:30", horaFin: "19:30", profe: "Mary", revisar: SIN_LIBRETA },

  // ── VIERNES (foto 8) ───────────────────────────────────────────────────────
  { alumno: "Florencia Aliaga", dia: "Viernes", hora: "17:30", horaFin: "19:30", profe: "Mary", mensualidad: 120000, revisar: `${SIN_LIBRETA} (la Florencia de la libreta es Florencia Mohr, otro apellido)` },
  { alumno: "Isabella Yobanolo", dia: "Viernes", hora: "17:30", horaFin: "18:30", profe: "Mary", mensualidad: 60000, contacto: "Isabella Yobanolo Baeza" },
  { alumno: "Amanda", dia: "Viernes", hora: "17:30", horaFin: "18:30", profe: "Mary", mensualidad: 60000, contacto: "Amanda Diaz" },
  { alumno: "Emilia", dia: "Viernes", hora: "17:30", horaFin: "18:30", profe: "Mary", mensualidad: 60000, revisar: "hay dos en la libreta: Emilia Matus Cardenas y Emilia Rojas Guevara" },
  { alumno: "Tiara", dia: "Viernes", hora: "18:30", horaFin: "19:30", profe: "Paula", mensualidad: 60000, contacto: "Tiara Collica" },
  { alumno: "elisa", dia: "Viernes", hora: "18:30", horaFin: "19:30", profe: "Paula", mensualidad: 60000, mismaQue: "Elisa Bade", revisar: SIN_LIBRETA },

  // ── SÁBADO (foto 9), el único día de mañana ────────────────────────────────
  { alumno: "Antonella", dia: "Sabado", hora: "11:00", horaFin: "13:00", profe: "Mary", mensualidad: 120000, contacto: "Antonella Garces Barría" },
  { alumno: "Elisa Bade", dia: "Sabado", hora: "11:00", horaFin: "13:00", profe: "Mary", mensualidad: 70000, revisar: SIN_LIBRETA },
  { alumno: "Diego Torres", dia: "Sabado", hora: "12:00", horaFin: "13:00", profe: "Mary", mensualidad: 60000, contacto: "Diego Torres" },
  { alumno: "Julieta", dia: "Sabado", hora: "11:00", horaFin: "12:00", profe: "Mary", mensualidad: 60000, mismaQue: "Julieta Bratz" },
  { alumno: "Valentina", dia: "Sabado", hora: "11:00", horaFin: "12:00", profe: "Mary", mensualidad: 60000, mismaQue: "Valentina Roa" },
  { alumno: "Elena Jerez", dia: "Sabado", hora: "11:00", horaFin: "13:00", profe: "Paula", mensualidad: 100000, contacto: "Elena Jerez Ahrens" },
  { alumno: "Sofía Llancaleo", dia: "Sabado", hora: "12:00", horaFin: "13:00", profe: "Paula", mensualidad: 60000, revisar: SIN_LIBRETA },
  // Repetido en la planilla, en la tabla de Paula. Lukas lo preguntó y confirmó el
  // 26-08-2026: el sábado es con Mary, así que esta fila NO se carga.
  { alumno: "Diego Torres", dia: "Sabado", hora: "12:00", horaFin: "13:00", profe: "Paula", mensualidad: 60000, duplicada: true },
];

/** 'GRACE' → 'Grace', 'diego' → 'Diego': la planilla escribe como puede, la ficha se ve bien. */
export function nombreDeFicha(n: string): string {
  return n
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export interface InscripcionPlan { dia: string | null; hora: string; horaFin: string; profe: string | null }
export interface AlumnoPlan {
  nombre: string;
  apoderado: string | null;
  telefono: string | null;
  mensualidad: number;
  notas: string | null;
  revisar: string | null;
  inscripciones: InscripcionPlan[];
}

/**
 * Convierte las 44 filas de la planilla en las fichas de alumno con sus días.
 * Un alumno que viene dos días (Mateo, Amanda) es UNA ficha con dos inscripciones.
 */
export function construirHorario(): AlumnoPlan[] {
  const porNombre = new Map<string, AlumnoPlan>();

  for (const f of PLANILLA_AGOSTO_2026) {
    // 'mismaQue' junta dos filas de la planilla en una sola ficha: es la misma niña
    // viniendo dos días, con el nombre completo de las dos veces que aparece.
    const nombre = nombreDeFicha(f.mismaQue ?? f.alumno);
    let a = porNombre.get(nombre);
    if (!a) {
      const c = f.contacto ? CONTACTOS_ARTELUK.find((x) => x[1] === f.contacto) : undefined;
      a = {
        nombre,
        apoderado: c ? c[0] : null,
        telefono: c && c[2] ? c[2] : null,
        mensualidad: f.mensualidad ?? 0,
        notas: f.notas ?? null,
        revisar: f.revisar ?? null,
        inscripciones: [],
      };
      porNombre.set(nombre, a);
    } else {
      // Segunda fila del mismo alumno: se completa lo que la primera no traía.
      if (!a.mensualidad && f.mensualidad) a.mensualidad = f.mensualidad;
      if (!a.notas && f.notas) a.notas = f.notas;
      if (!a.revisar && f.revisar) a.revisar = f.revisar;
      // Y si le faltaba el apoderado, se lo pone la otra fila (la Julieta del sábado
      // no traía teléfono; la Julieta Bratz del lunes, sí).
      if (!a.telefono && f.contacto) {
        const c2 = CONTACTOS_ARTELUK.find((x) => x[1] === f.contacto);
        if (c2) { a.apoderado = a.apoderado ?? c2[0]; a.telefono = c2[2] || null; }
      }
      // Dos mensualidades distintas para la misma niña NO se resuelven solas: la
      // planilla le pone $60.000 el viernes y $70.000 el sábado a la misma Elisa.
      if (f.mensualidad && a.mensualidad && f.mensualidad !== a.mensualidad) {
        const dudaPlata = `la planilla le pone dos mensualidades distintas ($${a.mensualidad.toLocaleString("es-CL")} y $${f.mensualidad.toLocaleString("es-CL")}): ¿cuál es la buena?`;
        a.revisar = a.revisar ? `${a.revisar}. Además ${dudaPlata}` : dudaPlata;
      }
    }
    // La fila repetida de la planilla se cuenta, pero no se carga dos veces.
    if (!f.duplicada) {
      a.inscripciones.push({ dia: f.dia, hora: f.hora, horaFin: f.horaFin, profe: f.profe });
    }
  }

  return [...porNombre.values()];
}

export interface SeedHorarioResult { alumnos: number; inscripciones: number; yaEstaban: number }

/**
 * Deja el horario cargado en la base. Idempotente: corre en cada arranque y no
 * duplica ni pisa lo que Mary haya corregido a mano (si el alumno ya existe, no se
 * toca su ficha; si ya tiene esa inscripción, no se repite).
 */
export function seedHorarioArteluk(): SeedHorarioResult {
  const plan = construirHorario();
  const existentes = new Map(listAlumnos().map((a) => [a.nombre, a.id]));
  let alumnos = 0, inscripciones = 0, yaEstaban = 0;

  for (const p of plan) {
    let id = existentes.get(p.nombre);
    if (id === undefined) {
      id = addAlumno({
        nombre: p.nombre, apoderado: p.apoderado, telefono: p.telefono,
        mensualidad: p.mensualidad, notas: p.notas, revisar: p.revisar,
      });
      alumnos++;
    } else {
      yaEstaban++;
    }
    const suyas = listInscripciones(id);
    for (const i of p.inscripciones) {
      const repetida = suyas.some((x) => x.dia === i.dia && x.hora === i.hora && x.horaFin === i.horaFin);
      if (repetida) continue;
      addInscripcion({ alumnoId: id, dia: i.dia, hora: i.hora, horaFin: i.horaFin, profe: i.profe });
      inscripciones++;
    }
  }

  return { alumnos, inscripciones, yaEstaban };
}

/**
 * La carga de la PRIMERA VEZ, que es la que corre sola al arrancar el servidor.
 * Solo siembra con la tabla vacía: en cuanto la app tiene alumnos, manda la app.
 * Si no, cada deploy le devolvería a Mary los alumnos que ella borró.
 */
export function seedHorarioSiVacio(): SeedHorarioResult {
  if (listAlumnos().length > 0) return { alumnos: 0, inscripciones: 0, yaEstaban: 0 };
  return seedHorarioArteluk();
}
