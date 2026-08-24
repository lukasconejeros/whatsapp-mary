// CUÁNDO EL BOT SE APARTA Y LLAMA A MARY.
//
// Encargo de Lukas (19-08-2026): *"cuando las personas ya digan que quieren la clase de prueba
// … cuando la persona muestre interés le tiene que decir dame unos minutos para ver
// disponibilidad y que se apague el chatbot"*.
//
// La línea fina: PREGUNTAR por la clase de prueba no es quererla. "¿tienen clase de prueba?" lo
// contesta el bot (para eso está); "quiero la clase de prueba" lo atiende Mary. Si se apagara
// también con las preguntas, Mary terminaría contestando todo y el bot no serviría de nada.
//
// Por qué el texto sale del sistema y no del modelo: cuando la frase la escribe el modelo, a
// veces promete ("le aviso a Mary") sin llamar a la herramienta que apaga el bot, y la persona
// queda esperando a alguien que nunca llega. Está anotado como error real en Medifis y en
// Anpalex. Acá la frase es fija y el apagado ocurre en el mismo paso.
//
// Sin extensión `.js` en el import de `db`: este módulo lo comparten el bot (tsx) y la app de
// Next, igual que `secciones-negocio.ts`.
import { insertMessage, enqueueOutbox, setMode } from "./db";

/** Lo que se le manda a la persona antes de apartarse. Lo eligió Lukas el 19-08-2026. */
export const FRASE_ESPERA = "Deme unos minutos y le confirmo disponibilidad";

// "Quiero saber", "quisiera consultar": eso es una pregunta, no querer la clase. Van primero
// porque llevan dentro un verbo de querer y si no se descartan aquí, disparan de más.
const SOLO_PREGUNTA: RegExp[] = [
  /\b(quiero|quisiera|queria|me gustaria)\s+(saber|preguntar|consultar|averiguar)\b/,
  /\b(quiero|quisiera)\s+(mas\s+)?(info|informacion)\b/,
];

// Las muchas formas de decir que sí. No hace falta que nombren la clase de prueba: a esta
// altura de la conversación es de lo único que se está hablando.
const LO_QUIERE: RegExp[] = [
  /\b(quiero|quisiera|queria|me gustaria|me interesa|me interesaria)\b/,
  /\b(inscribir|inscribirla|inscribirlo|inscribo|inscribirme|matricular)\b/,
  /\b(agendar|agendo|agendamos|reservar|reservo|apartar|tomar\s+la\s+(clase|hora))\b/,
  /\bcuando\s+(puede|podria|pueden|seria|la\s+hace|lo\s+hace|empieza)\b/,
  /\bcomo\s+(la|lo|me)\s+(agendo|inscribo|reservo|anoto)\b/,
  /\b(dale|ya|listo|perfecto|bueno)\b[^.]{0,20}\b(hagamos|hagamosla|vamos|agend|inscrib|prueba)\b/,
  /\b(la|lo)\s+(inscribo|llevo|mando)\b/,
  /\bllevarla\b|\bllevarlo\b/,
];

function sinTildes(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** ¿Ya dijo que la quiere, o todavía está preguntando? */
export function quiereLaClaseDePrueba(texto: string): boolean {
  const t = sinTildes(texto);
  if (!t.trim()) return false;
  if (SOLO_PREGUNTA.some((r) => r.test(t))) return false;
  return LO_QUIERE.some((r) => r.test(t));
}

/**
 * El bot se aparta: manda la frase, se apaga en ese chat y le avisa a Mary. Los tres pasos
 * van juntos a propósito — prometer sin apagarse deja a la persona esperando, y apagarse sin
 * avisar la deja esperando igual, pero en silencio.
 *
 * `setMode` (y no `setModeAutomatico`) marca el apagado como decisión firme: el automático ya
 * no vuelve a encender el bot en ese chat, igual que cuando contesta Mary.
 */
export function apartarParaMary(input: {
  conversationId: number;
  phone: string;
  texto: string;
  /** Cómo se le avisa a Mary. Se inyecta para poder probar esto sin notificaciones reales. */
  avisar?: (aviso: { titulo: string; cuerpo: string }) => void;
  nombre?: string;
}): void {
  const { conversationId, phone, texto, avisar, nombre } = input;

  insertMessage(conversationId, "assistant", FRASE_ESPERA);
  enqueueOutbox(conversationId, phone, FRASE_ESPERA);
  setMode(conversationId, "HUMAN");

  try {
    avisar?.({
      titulo: `Quiere clase de prueba: ${nombre || phone}`,
      cuerpo: texto.length > 80 ? texto.slice(0, 80) + "…" : texto,
    });
  } catch { /* un aviso que falla nunca puede tumbar al bot */ }
}
