// Portería del panel: decide qué hacer con quien se equivoca de contraseña.
//
// Existe porque hasta el 11-09-2026 el login de este panel aceptaba intentos infinitos: se midió,
// 10 intentos seguidos respondieron 401 en 20 ms cada uno (~3.000 contraseñas por minuto), y detrás
// hay fichas de pacientes reales y el botón que les escribe por WhatsApp a nombre de la clínica.
//
// Dos niveles, como los pidió Lukas:
//   - 3 fallos  → espera de 15 minutos. Es el techo de la secretaria que teclea mal; se destraba sola.
//   - 6 fallos  → CERRADO. Ya no se abre con el tiempo: hace falta un código que le llega a él.
//
// Este archivo es lógica PURA a propósito (el instante y el azar entran por parámetro): así los
// castigos largos se prueban sin esperarlos, y el guardado en disco vive aparte en `porteria-store.ts`.

/** Fallos que se aguantan antes de la primera espera. */
export const FALLOS_ANTES_DE_ESPERA = 3;
/** Fallos que se aguantan antes de cerrar de verdad. */
export const FALLOS_ANTES_DE_CERRAR = 6;
/** Cuánto dura la espera del primer nivel. */
export const ESPERA_MIN = 15;
/**
 * Cuántos fallos sueltos se recuerdan y por cuánto. Pasado este rato sin fallar, se olvida todo:
 * quien se equivocó dos veces el lunes no empieza el martes con la cuenta a medias.
 */
export const MEMORIA_MIN = 60;

const MINUTO = 60_000;

/** Lo que se guarda de cada dirección de internet que intenta entrar. */
export interface Ficha {
  /** Fallos acumulados desde el último acierto (o desde que se olvidó todo). */
  fallos: number;
  /** Instante del último fallo. */
  ultimo: number;
  /** Código de 6 dígitos que reabre la puerta. null mientras no esté cerrada. */
  codigo: string | null;
  /** Instante en que se cerró de verdad. null si no está cerrada. */
  cerradaEn: number | null;
}

export type Veredicto =
  /** Puede probar la contraseña. */
  | { paso: "adelante"; intentosRestantes: number }
  /** Está esperando el castigo del primer nivel. */
  | { paso: "espera"; restanteMs: number }
  /** Cerrada: ni esperando se abre, hace falta el código. */
  | { paso: "cerrada"; cerradaEn: number };

export const fichaNueva = (): Ficha => ({ fallos: 0, ultimo: 0, codigo: null, cerradaEn: null });

/** Una ficha sin cerrar y sin fallos recientes ya no dice nada: se puede olvidar. */
export function caducada(f: Ficha, ahora: number): boolean {
  if (f.cerradaEn !== null) return false; // una puerta cerrada NO caduca con el tiempo: eso es el punto
  return f.fallos > 0 && ahora - f.ultimo > MEMORIA_MIN * MINUTO;
}

/** ¿Qué hago con quien viene a intentar? No modifica nada. */
export function veredicto(f: Ficha | undefined, ahora: number): Veredicto {
  if (!f || caducada(f, ahora)) return { paso: "adelante", intentosRestantes: FALLOS_ANTES_DE_ESPERA };

  if (f.cerradaEn !== null) return { paso: "cerrada", cerradaEn: f.cerradaEn };

  if (f.fallos >= FALLOS_ANTES_DE_ESPERA) {
    const restanteMs = ESPERA_MIN * MINUTO - (ahora - f.ultimo);
    // Cumplida la espera, recupera sus intentos, pero los fallos NO se borran: son los que lo llevan
    // al cierre del segundo nivel si sigue insistiendo.
    if (restanteMs > 0) return { paso: "espera", restanteMs };
    return { paso: "adelante", intentosRestantes: FALLOS_ANTES_DE_CERRAR - f.fallos };
  }

  return { paso: "adelante", intentosRestantes: FALLOS_ANTES_DE_ESPERA - f.fallos };
}

/**
 * Anota un fallo y devuelve la ficha nueva. `sorteo` genera el código cuando toca cerrar
 * (entra por parámetro para que la prueba sepa qué código esperar).
 */
export function anotarFallo(
  previa: Ficha | undefined,
  ahora: number,
  sorteo: () => string,
): { ficha: Ficha; seCierraAhora: boolean } {
  const base = !previa || caducada(previa, ahora) ? fichaNueva() : previa;
  if (base.cerradaEn !== null) return { ficha: base, seCierraAhora: false };

  const fallos = base.fallos + 1;
  const cierra = fallos >= FALLOS_ANTES_DE_CERRAR;
  return {
    ficha: {
      fallos,
      ultimo: ahora,
      codigo: cierra ? sorteo() : null,
      cerradaEn: cierra ? ahora : null,
    },
    seCierraAhora: cierra,
  };
}

/** Código de 6 dígitos, fácil de dictar por teléfono. */
export function sortearCodigo(azar: () => number = Math.random): string {
  return String(Math.floor(azar() * 900_000) + 100_000);
}

/** Texto para la persona que está al otro lado, en cristiano y sin regalar pistas. */
export function textoVeredicto(v: Veredicto): string {
  if (v.paso === "espera") {
    const min = Math.ceil(v.restanteMs / MINUTO);
    return min <= 1
      ? "Demasiados intentos. Espera un minuto y vuelve a intentarlo."
      : `Demasiados intentos. Espera ${min} minutos y vuelve a intentarlo.`;
  }
  if (v.paso === "cerrada") {
    return "El acceso quedó bloqueado por seguridad. Pídele el código de desbloqueo al administrador.";
  }
  return "";
}
