import { setMode } from "../db.js";

export const silenciarDefinition = {
  type: "function" as const,
  function: {
    name: "silenciar",
    description:
      "Silencia al contacto: el bot deja de responderle para siempre. " +
      "Usar cuando el primer mensaje de una conversación nueva NO viene de alguien interesado en Orion. " +
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
  if (args.conversationId) {
    setMode(args.conversationId, "HUMAN");
  }
  return {
    ok: true,
    instruccion: "CRÍTICO: No envíes ningún mensaje al usuario. Devuelve texto vacío.",
  };
}
