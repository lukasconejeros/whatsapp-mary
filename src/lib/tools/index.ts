// Tool registry — agregar definición Y handler por cada nueva tool

import { guardarLeadDefinition, guardarLead } from "./guardar-lead.js";
import { calificarDefinition, calificar } from "./calificar.js";
import { derivarHumanoDefinition, derivarHumano } from "./derivar-humano.js";
import { agendarDefinition, agendar } from "./agendar.js";
import { silenciarDefinition, silenciar } from "./silenciar.js";
import { marcarInteresDefinition, marcarInteres } from "./marcar-interes.js";

export type ToolContext = { conversationId: number; phone?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolDef = { type: "function"; function: { name: string; description: string; parameters: any } };
type Handler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<Record<string, unknown>>;

export const toolDefinitions: ToolDef[] = [
  silenciarDefinition,
  calificarDefinition,
  marcarInteresDefinition,
  agendarDefinition,
  guardarLeadDefinition,
  derivarHumanoDefinition,
];

const handlers: Record<string, Handler> = {
  silenciar:      (args, ctx) => silenciar({ ...args, conversationId: ctx.conversationId }),
  calificar:      (args, ctx) => calificar({ ...args, conversationId: ctx.conversationId }),
  marcar_interes: (args, ctx) => marcarInteres({ ...args, conversationId: ctx.conversationId }),
  agendar:        (args, ctx) => agendar(args, { conversationId: ctx.conversationId }),
  guardarLead:    (args, ctx) => guardarLead({ ...args, conversationId: ctx.conversationId }),
  derivarHumano:  (args, ctx) => derivarHumano({ ...args, conversationId: ctx.conversationId }),
};

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  const handler = handlers[toolName];
  if (!handler) return { ok: false, message: "Tool desconocida: " + toolName };
  return handler(args, ctx);
}
