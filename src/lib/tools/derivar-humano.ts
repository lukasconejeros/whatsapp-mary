import { setMode } from "../db";

// El ejemplo que se le da al modelo para el traspaso. Va de usted: el modelo copia estos
// ejemplos palabra por palabra, y de ahí salían los tuteos (regla antituteo, 24-08-2026).
export const INSTRUCCION_DERIVAR =
  "Responde al usuario con algo como: 'Le paso con una persona del equipo, le escribe enseguida.' No respondas más en esta conversación.";

// Derivar SIN decir nada (08-09-2026). Lo cazó la prueba contra el modelo real: ante "mi hijo
// tiene autismo nivel 1" el manual manda callarse, y el bot contestó igual "le paso con una
// persona del equipo" — porque esa frase se la ordena esta tool, y una orden que llega después
// le gana a cualquier regla del manual. Los temas delicados los atiende Mary en persona.
export const INSTRUCCION_DERIVAR_SILENCIOSA =
  "CRÍTICO: No escribas ningún mensaje al usuario. Devuelve texto vacío. Mary sigue desde aquí.";

export const derivarHumanoDefinition = {
  type: "function" as const,
  function: {
    name: "derivarHumano",
    description:
      "Le pasa la conversación a Mary para que siga ella. Úsala SIEMPRE en el mismo mensaje en que " +
      "digas 'le aviso a Mary' o 'Mary le confirma' — prometerlo sin llamarla deja a la persona " +
      "esperando para siempre. Úsala también en cuanto tengas el nombre del apoderado y el nombre y " +
      "la edad del alumno, aunque todavía no haya elegido horario; cuando pidan cupo o agendar; " +
      "ante un reclamo o algo de plata ya pagada; y ante cualquier cosa que no esté en tus datos. " +
      "Úsala con silencioso=true ante un tema delicado (el diagnóstico o la condición de un niño, " +
      "arteterapia, psicólogos): eso lo contesta Mary en persona.",
    parameters: {
      type: "object" as const,
      properties: {
        razon: {
          type: "string",
          description: "Por qué se deriva. Útil para el operador.",
        },
        silencioso: {
          type: "boolean",
          description:
            "true para temas delicados (diagnóstico de un niño, arteterapia, psicólogos): no se " +
            "escribe NADA y espera Mary. Por defecto false, que sí manda una línea a la persona.",
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

  const callado = args.silencioso === true || args.silencioso === "true";
  return {
    ok: true,
    message: "Conversación derivada a HUMAN. Razón: " + (args.razon ?? ""),
    instruccion: callado ? INSTRUCCION_DERIVAR_SILENCIOSA : INSTRUCCION_DERIVAR,
  };
}
