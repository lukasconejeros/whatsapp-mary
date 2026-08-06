// Tool registry — agregar definición Y handler por cada nueva tool

// Arteluk (06-08-2026): fuera 'agendar' y 'calificar'. La primera creaba un evento en
// el Google Calendar de Orion y mandaba un email de demo; la segunda pregunta si el
// lead factura más de 5.000€/mes. Ninguna tiene sentido en el taller de arte, y el bot
// no debe poder llamarlas ni por error. Los archivos siguen en disco para el kit.
// Sin extensión .js: desde el 06-08 esta cadena también la compila Next, porque el
// chat de ensayo muestra las mismas herramientas que usa el bot. tsx (start:bot) las
// resuelve igual con o sin extensión.
import { guardarLeadDefinition, guardarLead } from "./guardar-lead";
import { derivarHumanoDefinition, derivarHumano } from "./derivar-humano";
import { silenciarDefinition, silenciar } from "./silenciar";
import { marcarInteresDefinition, marcarInteres } from "./marcar-interes";

export type ToolContext = { conversationId: number; phone?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolDef = { type: "function"; function: { name: string; description: string; parameters: any } };
type Handler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<Record<string, unknown>>;

export const toolDefinitions: ToolDef[] = [
  silenciarDefinition,
  marcarInteresDefinition,
  guardarLeadDefinition,
  derivarHumanoDefinition,
];

const handlers: Record<string, Handler> = {
  silenciar:      (args, ctx) => silenciar({ ...args, conversationId: ctx.conversationId }),
  marcar_interes: (args, ctx) => marcarInteres({ ...args, conversationId: ctx.conversationId }),
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
