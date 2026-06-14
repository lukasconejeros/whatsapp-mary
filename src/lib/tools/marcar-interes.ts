import { setEstado } from "../db.js";

export const marcarInteresDefinition = {
  type: "function" as const,
  function: {
    name: "marcar_interes",
    description:
      "Marca que el lead mostró interés en agendar una reunión/demo (dijo que quiere agendar, " +
      "que le interesa, que coordinemos una llamada, etc.) pero AÚN no ha cerrado fecha ni dado sus datos. " +
      "Llama esta tool en cuanto el lead exprese intención de agendar, antes de pedirle los datos. " +
      "NO la uses si el lead ya completó el agendamiento (eso lo maneja la tool agendar).",
    parameters: { type: "object" as const, properties: {}, required: [] },
  },
};

export async function marcarInteres(
  args: Record<string, unknown> & { conversationId?: number }
): Promise<Record<string, unknown>> {
  if (args.conversationId) {
    try { setEstado(args.conversationId, "resuelto"); } catch { /* no bloquear */ }
  }
  return { ok: true, message: "Lead marcado con interés de agendar (estado: resuelto)." };
}
