export const calificarDefinition = {
  type: "function" as const,
  function: {
    name: "calificar",
    description:
      "Califica al lead con una puntuación del 0 al 10. Devuelve si el lead encaja (score >= 7) para proceder a agendar.",
    parameters: {
      type: "object" as const,
      properties: {
        tieneNegocioActivo: {
          type: "boolean",
          description: "¿El lead tiene un negocio activo?",
        },
        facturaMasDe5kMes: {
          type: "boolean",
          description: "¿Factura más de 5.000€/mes?",
        },
        dolorEncajaConPropuesta: {
          type: "boolean",
          description: "¿Su dolor encaja con nuestra propuesta de valor?",
        },
        urgenciaAlta: {
          type: "boolean",
          description: "¿Tiene urgencia alta para resolver su problema?",
        },
        presupuestoConfirmado: {
          type: "boolean",
          description: "¿Ha confirmado que tiene presupuesto?",
        },
      },
      // TODO: Los pesos son ajustables según el negocio del usuario
    },
  },
};

export async function calificar(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let score = 0;
  if (args.tieneNegocioActivo) score += 3;
  if (args.facturaMasDe5kMes) score += 3;
  if (args.dolorEncajaConPropuesta) score += 2;
  if (args.urgenciaAlta) score += 1;
  if (args.presupuestoConfirmado) score += 1;

  const califica = score >= 7;

  return {
    ok: true,
    score,
    califica,
    mensaje: califica
      ? "Lead cualificado. Procede a agendar llamada."
      : "Lead NO cualificado. Responde cordialmente sin agendar.",
  };
}
