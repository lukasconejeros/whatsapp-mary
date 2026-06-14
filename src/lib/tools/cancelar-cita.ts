// Tool: cancelar_cita
import {
  dlFetch, buscarPacienteDentalink, getCitasProximas,
  detectaOxidoPabellon, ID_A_NOMBRE,
} from "./dentalink.js";

export const cancelarCitaDefinition = {
  type: "function" as const,
  function: {
    name: "cancelar_cita",
    description:
      "Cancela una cita en Dentalink. PASO 1: llamar con phone/rut para BUSCAR (devuelve cita_encontrada_pedir_confirmacion). PASO 3: llamar con id_cita_dentalink para EJECUTAR la cancelación (solo cuando el paciente confirmó).",
    parameters: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Teléfono (sin +). Para búsqueda en PASO 1." },
        rut: { type: "string", description: "RUT. Para búsqueda si phone falla." },
        id_cita_dentalink: { type: "number", description: "ID exacto. Para ejecutar cancelación en PASO 3." },
      },
    },
  },
};

const ID_ESTADO_CANCELADA = 4; // Dentalink: 4 = cancelada

export async function cancelarCita(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const phone = args.phone ? String(args.phone).replace(/\D/g, "") : null;
  const rut = args.rut ? String(args.rut).toUpperCase().trim() : null;
  const idCitaEjecutar = args.id_cita_dentalink ? Number(args.id_cita_dentalink) : null;

  // PASO 3 — ejecutar cancelación
  if (idCitaEjecutar) {
    return await ejecutarCancelacion(idCitaEjecutar);
  }

  // PASO 1 — buscar cita
  const paciente = await buscarPacienteDentalink({ phone: phone ?? undefined, rut: rut ?? undefined });
  if (!paciente) {
    return {
      ok: false,
      estado: phone ? "paciente_no_encontrado_por_phone" : "paciente_no_encontrado",
    };
  }

  const citas = await getCitasProximas(paciente.id_paciente, 30);
  if (citas.length === 0) {
    return {
      ok: false,
      estado: phone ? "sin_citas_proximas_phone" : "sin_citas_proximas",
      nombre: paciente.nombre,
    };
  }

  if (citas.length > 1) {
    return {
      ok: false,
      estado: "multiples_citas_pedir_eleccion",
      citas: citas.map((c) => ({
        id_cita: c.id_cita,
        fecha: c.fecha,
        hora: c.hora,
        doctor: c.nombre_dentista,
        tratamiento: c.tratamiento,
      })),
    };
  }

  return {
    ok: false,
    estado: "cita_encontrada_pedir_confirmacion",
    id_cita: citas[0].id_cita,
    fecha: citas[0].fecha,
    hora: citas[0].hora,
    doctor: citas[0].nombre_dentista,
    tratamiento: citas[0].tratamiento,
  };
}

async function ejecutarCancelacion(idCita: number): Promise<Record<string, unknown>> {
  try {
    const current = (await dlFetch("GET", `/citas/${idCita}`)) as {
      data?: { fecha: string; hora_inicio: string; id_dentista: number; nombre_tratamiento?: string; id_paciente: number };
    };
    const cita = current?.data;
    if (!cita) return { ok: false, error: "Cita no encontrada" };

    const fecha = cita.fecha;
    const hora = cita.hora_inicio?.slice(0, 5) ?? "";
    const tieneOxido = await detectaOxidoPabellon(cita.id_paciente, idCita, fecha, hora);

    await dlFetch("PUT", `/citas/${idCita}`, { id_estado: ID_ESTADO_CANCELADA });

    if (tieneOxido) {
      try {
        const todasCitas = await getCitasProximas(cita.id_paciente);
        const citaOxido = todasCitas.find(
          (c) => c.id_cita !== idCita && c.fecha === fecha && c.hora === hora && c.tratamiento.toUpperCase().includes("OXIDO")
        );
        if (citaOxido) await dlFetch("PUT", `/citas/${citaOxido.id_cita}`, { id_estado: ID_ESTADO_CANCELADA });
      } catch { /* no crítico */ }
    }

    return {
      ok: true,
      success: true,
      id_cita: idCita,
      fecha,
      hora,
      doctor: ID_A_NOMBRE[cita.id_dentista] ?? `Doctor ${cita.id_dentista}`,
      tratamiento: cita.nombre_tratamiento ?? "",
      incluye_oxido_pabellon: tieneOxido,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
