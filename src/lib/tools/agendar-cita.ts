// Tool: agendar_cita
import {
  dlFetch, buscarPacienteDentalink, crearPacienteDentalink, ID_A_NOMBRE, ID_SUCURSAL,
} from "./dentalink.js";

export const agendarCitaDefinition = {
  type: "function" as const,
  function: {
    name: "agendar_cita",
    description:
      "Agenda una cita nueva en Dentalink. Requiere servicio, doctor, fecha+hora y datos del paciente (RUT + nombre si no está en el sistema). Llamar SOLO después de confirmar disponibilidad con consultar_disponibilidad_horarios.",
    parameters: {
      type: "object" as const,
      properties: {
        rut: { type: "string", description: "RUT del paciente (ej: 12345678-K)" },
        nombre_paciente: { type: "string", description: "Nombre completo del paciente" },
        id_dentista: { type: "number", description: "ID del doctor" },
        fecha_hora: { type: "string", description: "Fecha y hora en formato YYYY-MM-DD HH:MM" },
        id_servicio: { type: "string", description: "ID del servicio del catálogo (ej: ANP-004)" },
        phone: { type: "string", description: "Teléfono WhatsApp del paciente (inyectado por contexto)" },
      },
      required: ["rut", "nombre_paciente", "id_dentista", "fecha_hora", "id_servicio"],
    },
  },
};

export async function agendarCitaNueva(
  args: Record<string, unknown>,
  ctx: { phone?: string }
): Promise<Record<string, unknown>> {
  const rut = String(args.rut ?? "").toUpperCase().trim();
  const nombre = String(args.nombre_paciente ?? "").trim();
  const idDentista = Number(args.id_dentista);
  const fechaHora = String(args.fecha_hora ?? "");
  const idServicio = String(args.id_servicio ?? "");
  const phone = String(args.phone ?? ctx.phone ?? "").replace(/\D/g, "");

  if (!rut || !nombre || !idDentista || !fechaHora || !idServicio) {
    return { ok: false, error: "Faltan parámetros requeridos" };
  }

  const [fecha, hora] = fechaHora.split(" ");
  if (!fecha || !hora) {
    return { ok: false, error: "fecha_hora debe ser YYYY-MM-DD HH:MM" };
  }

  // Buscar o crear paciente en Dentalink
  let paciente = await buscarPacienteDentalink({ rut });
  if (!paciente && phone) paciente = await buscarPacienteDentalink({ phone });

  let idPaciente: number;
  if (paciente) {
    idPaciente = paciente.id_paciente;
  } else {
    const nuevo = await crearPacienteDentalink({ nombre, rut, phone });
    if (!nuevo) {
      return { ok: false, error: "no_se_pudo_crear_paciente — derivar a humano" };
    }
    idPaciente = nuevo;
  }

  // Crear la cita
  try {
    const body = {
      id_paciente: idPaciente,
      id_dentista: idDentista,
      id_sucursal: ID_SUCURSAL(),
      fecha,
      hora_inicio: hora,
      id_tratamiento: idServicio, // Dentalink acepta el id del catálogo
    };

    const result = (await dlFetch("POST", "/citas", body)) as {
      data?: { id: number };
    };

    const idCita = result?.data?.id;
    if (!idCita) return { ok: false, error: "Dentalink no devolvió ID de cita" };

    return {
      ok: true,
      success: true,
      id_cita_creada: idCita,
      id_paciente: idPaciente,
      fecha,
      hora,
      doctor: ID_A_NOMBRE[idDentista] ?? `Doctor ${idDentista}`,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
