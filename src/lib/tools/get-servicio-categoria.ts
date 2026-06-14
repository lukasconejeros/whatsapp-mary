// Tool: get_servicio_categoria
// Devuelve la categoría VERDE/AMARILLO/ROJO de un servicio y si el bot puede agendarlo

export const getServicioCategoriaDefinition = {
  type: "function" as const,
  function: {
    name: "get_servicio_categoria",
    description:
      "Devuelve la categoría de un servicio: VERDE (bot puede agendar), AMARILLO (necesita validación), ROJO (siempre derivar a humano). También devuelve si hay doctor offline involucrado.",
    parameters: {
      type: "object" as const,
      properties: {
        id_servicio: { type: "string", description: "ID del servicio (ej: ANP-004)" },
        id_dentista: { type: "number", description: "ID del doctor (opcional)" },
      },
      required: ["id_servicio"],
    },
  },
};

// Doctores offline — sus citas siempre se derivan
const OFFLINE_DOCTORS = [47, 66, 89, 95];

// Especialidades que son siempre ROJO
const ESPECIALIDADES_ROJAS = ["periodoncia", "ortodoncia", "endodoncia", "cirugia", "implantologia", "implant"];

export async function getServicioCategoria(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const idServicio = String(args.id_servicio ?? "").toLowerCase();
  const idDentista = args.id_dentista ? Number(args.id_dentista) : null;

  // Doctor offline → siempre derivar
  if (idDentista && OFFLINE_DOCTORS.includes(idDentista)) {
    return {
      ok: true,
      id_servicio: args.id_servicio,
      categoria: "ROJO",
      agendable_bot: "NO",
      requiere_derivacion: true,
      razon_derivacion: `Doctor offline (id ${idDentista}) — coordina agenda aparte`,
      doctor_offline: true,
    };
  }

  // Especialidades rojas por nombre de servicio
  const esRojo = ESPECIALIDADES_ROJAS.some((e) => idServicio.includes(e));
  if (esRojo) {
    return {
      ok: true,
      id_servicio: args.id_servicio,
      categoria: "ROJO",
      agendable_bot: "NO",
      requiere_derivacion: true,
      razon_derivacion: "Especialidad que requiere coordinación con asistente del doctor",
      doctor_offline: false,
    };
  }

  // Para el resto, confiar en el catálogo (infoServicio ya devuelve categoria)
  return {
    ok: true,
    id_servicio: args.id_servicio,
    categoria: "VERDE",
    agendable_bot: "SI",
    requiere_derivacion: false,
    doctor_offline: false,
  };
}
