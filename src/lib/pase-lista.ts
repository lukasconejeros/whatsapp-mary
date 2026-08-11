// Interpreta lo que Mary contesta al pase de lista de las 21:00.
//
// NO usa IA a propósito (Lukas, 11-08-2026: "no es tanto conversacional, sino
// tarea específica"): la lista de nombres del día ya se conoce, así que esto es
// buscar esos nombres en la frase. Sale gratis, responde al instante y —lo que
// importa— no puede inventarse un alumno que no existe.
//
// LA REGLA DE ORO: ante la duda NO se adivina, se vuelve a preguntar. Marcar mal
// a un niño le rompe la confianza en el calendario; preguntar de nuevo, no.
//
// Entra el texto tal cual (si vino por audio, ya viene transcrito por el handler)
// y la lista CERRADA de alumnos a los que se preguntó.

export type Lectura =
  | { tipo: "ok"; vino: string[]; falto: string[] }
  | { tipo: "no-entendi" };

/** Minúsculas, sin tildes y sin signos: "¿No fue Sofía?" → "no fue sofia". */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // los acentos, ya separados por NFD
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras con las que ella dice que alguien NO estuvo. */
const NEGACIONES = [
  "no vino", "no vinieron", "no fue", "no fueron", "no llego", "no llegaron",
  "no asistio", "no asistieron", "no estuvo", "no estuvieron", "no vine",
  "falto", "faltaron", "falta", "faltan", "menos",
];

/** Con estas dice que estuvieron todos. Se miran solo si no nombró a nadie. */
const TODOS_SI = [
  "si", "sip", "sipo", "sisi", "todos", "todas", "todo bien", "ok", "okey",
  "vinieron todos", "estuvieron todos", "llegaron todos",
];

/** "No faltó nadie" = vinieron todos. Va ANTES que "nadie", que significa lo contrario. */
const NADIE_FALTO = /\b(no falto (nadie|ninguno|ninguna)|(nadie|ninguno|ninguna) falto|no falta nadie)\b/;

/** "No vino nadie" = no vino ninguno. */
const NADIE_VINO = /\b(nadie|ninguno|ninguna)\b/;

/**
 * ¿Aparece este alumno en la frase? Basta su PRIMER nombre, que es como lo dice
 * ella ("no vino sofia" para "Sofía Pérez"), y como palabra entera: "tomasa" no
 * es "Tomás".
 *
 * Si dos alumnos del día comparten el primer nombre, los dos quedan marcados
 * igual. Es lo correcto sin más información, y ella lo corrige en el panel.
 */
function mencionado(alumno: string, textoNorm: string): boolean {
  const primero = normalizar(alumno).split(" ")[0];
  if (!primero) return false;
  return new RegExp(`(^|\\s)${primero}(\\s|$)`).test(textoNorm);
}

export function interpretarPaseLista(texto: string, alumnos: string[]): Lectura {
  // Sin nadie a quien pasarle lista, no hay nada que interpretar.
  if (!alumnos.length) return { tipo: "no-entendi" };

  const t = normalizar(texto ?? "");
  if (!t) return { tipo: "no-entendi" };

  const nombrados = alumnos.filter((a) => mencionado(a, t));
  const hayNegacion = NEGACIONES.some((n) => new RegExp(`(^|\\s)${n}(\\s|$)`).test(t));

  // 1. "No faltó nadie" primero: contiene "nadie" pero significa lo contrario.
  if (NADIE_FALTO.test(t)) return { tipo: "ok", vino: [...alumnos], falto: [] };

  // 2. "No vino nadie" / "ninguno".
  if (NADIE_VINO.test(t) && !nombrados.length) return { tipo: "ok", vino: [], falto: [...alumnos] };

  // 3. Nombró a alguien: solo vale si además dijo que NO estuvo. Sin eso la
  //    frase es ambigua ("vino solo Mateo") y se prefiere preguntar.
  if (nombrados.length) {
    if (!hayNegacion) return { tipo: "no-entendi" };
    return {
      tipo: "ok",
      vino: alumnos.filter((a) => !nombrados.includes(a)),
      falto: nombrados,
    };
  }

  // 4. Dijo que faltó alguien pero ese alguien no es de hoy ("no fue Benjamín"):
  //    no se inventa un alumno ni se marca al azar.
  if (hayNegacion) return { tipo: "no-entendi" };

  // 5. Sin nombres y sin negación: solo se acepta si dijo claramente que sí.
  const dijoQueSi = TODOS_SI.some((p) => new RegExp(`(^|\\s)${p}(\\s|$)`).test(t));
  if (dijoQueSi) return { tipo: "ok", vino: [...alumnos], falto: [] };

  return { tipo: "no-entendi" };
}
