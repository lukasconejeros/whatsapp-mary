import { setMode } from "../db";

// El ejemplo que se le da al modelo para el traspaso. Va de usted: el modelo copia estos
// ejemplos palabra por palabra, y de ahí salían los tuteos (regla antituteo, 24-08-2026).
export const INSTRUCCION_DERIVAR =
  "Responde al usuario con algo como: 'Le paso con una persona del equipo, le escribe enseguida.' No respondas más en esta conversación.";

export const derivarHumanoDefinition = {
  type: "function" as const,
  function: {
    name: "derivarHumano",
    description:
      "Le pasa la conversación a Mary para que siga ella. Úsala SIEMPRE en el mismo mensaje en que " +
      "digas 'le aviso a Mary' o 'Mary le confirma' — prometerlo sin llamarla deja a la persona " +
      "esperando para siempre. Úsala también en cuanto tengas el nombre del apoderado y el nombre y " +
      "la edad del alumno, aunque todavía no haya elegido horario; cuando pidan cupo o agendar; " +
      "cuando pregunten por arteterapia; ante un reclamo o algo de plata ya pagada; y ante cualquier " +
      "cosa que no esté en tus datos.",
    parameters: {
      type: "object" as const,
      properties: {
        razon: {
          type: "string",
          description: "Por qué se deriva. Útil para el operador.",
        },
      },
      required: ["razon"],
      // Note: conversationId is NOT in the schema — it's injected by executeTool
    },
  },
};

export async function derivarHumano(
  args: Record<string, unknown> & { conversationId?: number }
): Promise<Record<string, unknown>> {
  if (!args.conversationId) {
    return {
      ok: false,
      message:
        "No se pudo derivar: falta conversationId (bug del wrapper de tools)",
    };
  }

  setMode(args.conversationId, "HUMAN");

  return {
    ok: true,
    message: "Conversación derivada a HUMAN. Razón: " + (args.razon ?? ""),
    instruccion: INSTRUCCION_DERIVAR,
  };
}
