// Tool: confirmar_cita_existente
import {
  dlFetch, buscarPacienteDentalink, getCitasProximas,
  detectaOxidoPabellon, ID_A_NOMBRE,
} from "./dentalink.js";

export const confirmarCitaDefinition = {
  type: "function" as const,
  function: {
    name: "confirmar_cita_existente",
    description:
      "Confirma la asistencia del paciente a su cita próxima en Dentalink. Busca por phone primero; si falla, por RUT. Si hay múltiples citas, las devuelve para que el agente pregunte al paciente cuál confirmar.",
    parameters: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Teléfono del paciente (sin +)" },
        rut: { type: "string", description: "RUT del paciente" },
        id_cita_dentalink: { type: "number", description: "ID exacto de la cita (si ya se conoce)" },
      },
    },
  },
};

const ID_ESTADO_CONFIRMADO = 1; // Dentalink: 1 = confirmada

export async function confirmarCita(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const phone = args.phone ? String(args.phone).replace(/\D/g, "") : null;
  const rut = args.rut ? String(args.rut).toUpperCase().trim() : null;
  const idCitaDirecto = args.id_cita_dentalink ? Number(args.id_cita_dentalink) : null;

  // Caso 1: ID directo — confirmar sin buscar
  if (idCitaDirecto) {
    return await confirmarPorId(idCitaDirecto);
  }

  // Caso 2: buscar paciente
  const paciente = await buscarPacienteDentalink({ phone: phone ?? undefined, rut: rut ?? undefined });
  if (!paciente) {
    return {
      ok: false,
      estado: phone ? "paciente_no_encontrado_por_phone" : "paciente_no_encontrado_por_rut",
    };
  }

  const citas = await getCitasProximas(paciente.id_paciente, 3); // solo 72h
  if (citas.length === 0) {
    return { ok: false, estado: "sin_citas_proximas", nombre: paciente.nombre };
  }

  if (citas.length > 1) {
    return {
      ok: false,
      estado: "multiples_citas",
      citas: citas.map((c) => ({
        id_cita: c.id_cita,
        fecha: c.fecha,
        hora: c.hora,
        doctor: c.nombre_dentista,
        tratamiento: c.tratamiento,
      })),
    };
  }

  return await confirmarPorId(citas[0].id_cita, paciente.id_paciente, citas[0]);
}

async function confirmarPorId(
  idCita: number,
  idPaciente?: number,
  citaInfo?: { fecha: string; hora: string; id_dentista: number; tratamiento: string }
): Promise<Record<string, unknown>> {
  try {
    // Verificar si ya está confirmada
    const current = (await dlFetch("GET", `/citas/${idCita}`)) as {
      data?: { id_estado: number; fecha: string; hora_inicio: string; id_dentista: number; nombre_tratamiento?: string; id_paciente: number };
    };
    const cita = current?.data;
    if (!cita) return { ok: false, error: "Cita no encontrada" };

    const yaConfirmada = cita.id_estado === ID_ESTADO_CONFIRMADO;

    if (!yaConfirmada) {
      await dlFetch("PUT", `/citas/${idCita}`, { id_estado: ID_ESTADO_CONFIRMADO });
    }

    const fecha = cita.fecha;
    const hora = cita.hora_inicio?.slice(0, 5) ?? "";
    const nombreDoc = ID_A_NOMBRE[cita.id_dentista] ?? `Doctor ${cita.id_dentista}`;

    // Detectar si hay cita de pabellón óxido vinculada
    const pId = idPaciente ?? cita.id_paciente;
    const tieneOxido = await detectaOxidoPabellon(pId, idCita, fecha, hora);

    if (tieneOxido && !yaConfirmada) {
      // Confirmar también la cita de óxido buscándola
      try {
        const todasCitas = await getCitasProximas(pId);
        const citaOxido = todasCitas.find(
          (c) => c.id_cita !== idCita && c.fecha === fecha && c.hora === hora && c.tratamiento.toUpperCase().includes("OXIDO")
        );
        if (citaOxido) {
          await dlFetch("PUT", `/citas/${citaOxido.id_cita}`, { id_estado: ID_ESTADO_CONFIRMADO });
        }
      } catch { /* no crítico */ }
    }

    return {
      ok: true,
      estado: yaConfirmada ? "ya_confirmada" : "confirmada",
      id_cita: idCita,
      fecha,
      hora,
      doctor: nombreDoc,
      tratamiento: cita.nombre_tratamiento ?? citaInfo?.tratamiento ?? "",
      incluye_oxido_pabellon: tieneOxido,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
