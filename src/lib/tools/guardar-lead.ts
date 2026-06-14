import { upsertLead } from "../db.js";

export const guardarLeadDefinition = {
  type: "function" as const,
  function: {
    name: "guardarLead",
    description:
      "Guarda los datos del lead en la base de datos local. " +
      "Úsala en cuanto tengas nombre y teléfono, aunque no tengas todos los datos.",
    parameters: {
      type: "object" as const,
      properties: {
        nombre:      { type: "string", description: "Nombre del lead" },
        telefono:    { type: "string", description: "Teléfono del lead" },
        negocio:     { type: "string", description: "Nombre o tipo de clínica" },
        facturacion: { type: "string", description: "Rango de facturación si lo mencionó" },
        dolor:       { type: "string", description: "Dolor o problema principal que expresó" },
      },
      required: ["nombre", "telefono"],
    },
  },
};

export async function guardarLead(
  args: Record<string, unknown> & { conversationId?: number }
): Promise<Record<string, unknown>> {
  try {
    upsertLead({
      conversationId: args.conversationId,
      phone:       String(args.telefono ?? ""),
      nombre:      args.nombre      ? String(args.nombre)      : undefined,
      negocio:     args.negocio     ? String(args.negocio)     : undefined,
      facturacion: args.facturacion ? String(args.facturacion) : undefined,
      dolor:       args.dolor       ? String(args.dolor)       : undefined,
    });
    return { ok: true, message: "Lead guardado en base de datos local." };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
