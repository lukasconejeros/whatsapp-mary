// Tool: procesar_reagendamiento
import {
  dlFetch, buscarPacienteDentalink, getCitasProximas,
  ID_A_NOMBRE, OFFLINE,
} from "./dentalink.js";

export const reagendarDefinition = {
  type: "function" as const,
  function: {
    name: "procesar_reagendamiento",
    description:
      "Procesa el reagendamiento de una cita. PASO 1: llamar con phone/rut para BUSCAR (devuelve cita_encontrada_pedir_confirmacion). Si doctor_offline=true, derivar a humano. PASO 3: llamar con id_cita_actual para ANULAR y pedir nueva fecha al paciente.",
    parameters: {
      type: "object" as const,
      properties: {
        phone: { type: "string", description: "Teléfono (sin +)" },
        rut: { type: "string", description: "RUT del paciente" },
        id_cita_actual: { type: "number", description: "ID de la cita a anular (para ejecutar en PASO 3)" },
      },
    },
  },
};

const ID_ESTADO_ANULADA = 3; // Dentalink: 3 = anulada (vs 4 = cancelada por paciente)

export async function reagendarCita(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const phone = args.phone ? String(args.phone).replace(/\D/g, "") : null;
  const rut = args.rut ? String(args.rut).toUpperCase().trim() : null;
  const idCitaActual = args.id_cita_actual ? Number(args.id_cita_actual) : null;

  // PASO 3 — anular cita actual y liberar slot
  if (idCitaActual) {
    try {
      const current = (await dlFetch("GET", `/citas/${idCitaActual}`)) as {
        data?: { fecha: string; hora_inicio: string; id_dentista: number; nombre_tratamiento?: string };
      };
      const cita = current?.data;
      if (!cita) return { ok: false, error: "Cita no encontrada" };

      await dlFetch("PUT", `/citas/${idCitaActual}`, { id_estado: ID_ESTADO_ANULADA });

      return {
        ok: true,
        success: true,
        cita_anulada: {
          id_cita: idCitaActual,
          fecha: cita.fecha,
          hora: cita.hora_inicio?.slice(0, 5) ?? "",
          doctor: ID_A_NOMBRE[cita.id_dentista] ?? `Doctor ${cita.id_dentista}`,
        },
        siguiente_paso: "Preguntar al paciente qué fecha y hora prefiere para el nuevo turno.",
      };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
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
        doctor_offline: OFFLINE.includes(c.id_dentista),
        tratamiento: c.tratamiento,
      })),
    };
  }

  const c = citas[0];
  const esOffline = OFFLINE.includes(c.id_dentista);

  if (esOffline) {
    return {
      ok: false,
      estado: "cita_encontrada_pedir_confirmacion",
      doctor_offline: true,
      id_cita: c.id_cita,
      fecha: c.fecha,
      hora: c.hora,
      doctor: c.nombre_dentista,
      tratamiento: c.tratamiento,
      instruccion: "Doctor offline — derivar a humano para coordinar reagendamiento.",
    };
  }

  return {
    ok: false,
    estado: "cita_encontrada_pedir_confirmacion",
    doctor_offline: false,
    id_cita: c.id_cita,
    fecha: c.fecha,
    hora: c.hora,
    doctor: c.nombre_dentista,
    tratamiento: c.tratamiento,
  };
}
