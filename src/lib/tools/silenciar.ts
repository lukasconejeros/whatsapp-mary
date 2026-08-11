import { setMode, getConversationById } from "../db";
import { esLeadDeAnuncio } from "../quien-contesta";

export const silenciarDefinition = {
  type: "function" as const,
  function: {
    name: "silenciar",
    description:
      "Silencia al contacto: el bot deja de responderle para siempre. " +
      "Usar cuando el primer mensaje de una conversación nueva NO viene de alguien interesado en el taller. " +
      "Después de llamar esta tool, NO envíes ningún mensaje al usuario.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
};

export async function silenciar(
  args: Record<string, unknown> & { conversationId?: number }
): Promise<Record<string, unknown>> {
  if (!args.conversationId) return { ok: true, instruccion: "CRÍTICO: No envíes ningún mensaje al usuario. Devuelve texto vacío." };

  // 🚫 CANDADO: a quien llegó por un anuncio NO se le calla nunca (Medifis #51).
  // Allí el modelo metía la plantilla de Meta ("Quiero resolver una duda (anuncio)") en
  // el saco de los mensajes que no se contestan, por corta y sin pregunta, y se perdían
  // leads pagados. El filtro de entrada es para la vida personal de Mary, no para ellos.
  const conv = getConversationById(args.conversationId);
  if (conv && esLeadDeAnuncio(conv)) {
    return {
      ok: false,
      motivo: "lead_de_anuncio",
      instruccion:
        "NO se puede silenciar: esta persona llegó por un anuncio pagado. " +
        "Contéstale con normalidad, preséntate y pregúntale para quién sería la clase.",
    };
  }

  setMode(args.conversationId, "HUMAN");
  return {
    ok: true,
    instruccion: "CRÍTICO: No envíes ningún mensaje al usuario. Devuelve texto vacío.",
  };
}
