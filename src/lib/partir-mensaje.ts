// UN MENSAJE = UNA IDEA.
//
// Encargo de Lukas (08-09-2026), de la auditoría de estilo Mary vs el bot: ella manda ideas
// sueltas y cortas, el bot mandaba parrafones. Medido sobre los 114 mensajes del bot en
// producción: 44 llevaban 2 o más párrafos en la MISMA burbuja y 20 llevaban 3 o más. Una
// clienta lo dijo textual (conv 395): "me agotó y me confundió".
//
// Se parte por PÁRRAFO (línea en blanco), nunca por frase: cortar por puntos deja burbujas
// partidas a la mitad y ahí el bot deja de sonar a persona. Los bloques de líneas seguidas
// —los horarios, los datos del banco— viajan enteros, porque así se leen.
//
// EL TOPE DE 3 ES ANTI-BANEO, no estética: una ráfaga de burbujas seguidas al mismo número es
// justo lo que WhatsApp castiga. Por eso también sale con pausa entre una y otra (ver
// `retrasosDeEnvio`), y el que las espacía es el outbox, no un setTimeout suelto: así
// sobreviven a un reinicio del bot.
//
// Sin extensión .js en los imports porque este módulo no importa nada: lo cargan igual el bot
// (tsx), la app de Next y los scripts.

/** Nunca más de tres burbujas seguidas por respuesta. */
export const MAX_MENSAJES = 3;

// Por debajo de esto no es una idea, es una coletilla ("😊", "Gracias", "¿Le parece?"): se pega
// a la burbuja vecina en vez de salir sola, que es lo que delata a un robot.
const MINIMO_TROZO = 20;

// Cuánto espera antes de la burbuja siguiente: el rato en que una persona escribiría lo que
// acaba de mandar. Suelo de 4 s (si no, salen las dos de un tirón) y techo de 12 s (si no, la
// mamá cree que se cortó la conversación).
const PAUSA_MINIMA_S = 4;
const PAUSA_MAXIMA_S = 12;
const LETRAS_POR_SEGUNDO = 40;

function unir(a: string, b: string): string {
  return `${a}\n\n${b}`;
}

// Las coletillas se pegan al vecino. Van hacia atrás (a la burbuja anterior) porque cierran lo
// que se acaba de decir; solo la primera se pega hacia adelante, que no tiene anterior.
function pegarLasCortas(trozos: string[]): string[] {
  if (trozos.length <= 1) return trozos;
  const out: string[] = [];
  for (const t of trozos) {
    if (t.length < MINIMO_TROZO && out.length > 0) {
      out[out.length - 1] = unir(out[out.length - 1], t);
    } else {
      out.push(t);
    }
  }
  // Si la primera era la corta, arrastró a nadie: se pega a la que sigue.
  if (out.length > 1 && out[0].length < MINIMO_TROZO) {
    const [primera, segunda, ...resto] = out;
    return [unir(primera, segunda), ...resto];
  }
  return out;
}

// Para bajar del tope se fusiona el par de vecinos MÁS CORTO, no los del final: así no queda
// una burbuja diminuta y otra con medio catálogo.
function bajarAlTope(trozos: string[]): string[] {
  const out = [...trozos];
  while (out.length > MAX_MENSAJES) {
    let mejor = 0;
    let menor = Infinity;
    for (let i = 0; i < out.length - 1; i++) {
      const suma = out[i].length + out[i + 1].length;
      if (suma < menor) { menor = suma; mejor = i; }
    }
    out.splice(mejor, 2, unir(out[mejor], out[mejor + 1]));
  }
  return out;
}

/**
 * Parte la respuesta del bot en las burbujas que se le van a mandar a la persona.
 * Devuelve [] si no hay nada que mandar; nunca devuelve trozos vacíos ni más de MAX_MENSAJES.
 */
export function partirEnMensajes(texto: string): string[] {
  const limpio = (texto ?? "").replace(/\r\n/g, "\n").trim();
  if (!limpio) return [];
  const parrafos = limpio
    .split(/\n[ \t]*\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (parrafos.length === 0) return [];
  return bajarAlTope(pegarLasCortas(parrafos));
}

/**
 * Segundos de espera de cada burbuja, contados desde que se encola la tanda (0 para la
 * primera, acumulados para las demás). La pausa la marca el largo de la burbuja ANTERIOR:
 * es lo que la persona ve "escribiéndose".
 */
export function retrasosDeEnvio(trozos: string[]): number[] {
  let acumulado = 0;
  return trozos.map((_, i) => {
    if (i === 0) return 0;
    const anterior = trozos[i - 1] ?? "";
    const pausa = Math.min(
      PAUSA_MAXIMA_S,
      PAUSA_MINIMA_S + Math.round(anterior.length / LETRAS_POR_SEGUNDO)
    );
    acumulado += pausa;
    return acumulado;
  });
}
