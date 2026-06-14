import { setMode } from "../db.js";

export const derivarHumanoDefinition = {
  type: "function" as const,
  function: {
    name: "derivarHumano",
    description:
      "Cambia la conversación a Modo Humano para que un operador real continúe. Usar cuando el lead pide precios específicos, hace quejas, o está fuera del alcance del agente.",
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
    instruccion:
      "Responde al usuario con algo como: 'Te paso con una persona del equipo, te escribe enseguida.' No respondas más en esta conversación.",
  };
}
