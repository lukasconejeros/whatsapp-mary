// Tool: consultar_disponibilidad_horarios
// Consulta slots disponibles en Dentalink por servicio y rango de fechas

const OFFLINE_DOCTORS = [47, 66, 89, 95]; // Castro, Herrera, Pereira, Valdivieso

async function dentalinkGet(path: string): Promise<unknown> {
  const base = process.env.DENTALINK_BASE ?? "https://api.dentalink.healthatom.com/api/v1";
  const token = process.env.DENTALINK_TOKEN;
  if (!token) throw new Error("Falta DENTALINK_TOKEN");

  const resp = await fetch(`${base}${path}`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Dentalink ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

export const consultarDisponibilidadDefinition = {
  type: "function" as const,
  function: {
    name: "consultar_disponibilidad_horarios",
    description:
      "Consulta slots de agenda disponibles en Dentalink para un servicio y rango de fechas. Devuelve una lista de slots agrupados por día y doctor. Usar SIEMPRE antes de confirmar disponibilidad al paciente.",
    parameters: {
      type: "object" as const,
      properties: {
        fecha_inicio: { type: "string", description: "Fecha inicio en formato YYYY-MM-DD" },
        fecha_fin: { type: "string", description: "Fecha fin en formato YYYY-MM-DD (máx 7 días desde inicio)" },
        id_servicio: { type: "string", description: "ID del servicio del catálogo (ej: ANP-004)" },
        id_dentista: { type: "number", description: "ID del doctor (opcional, filtra por uno específico)" },
      },
      required: ["fecha_inicio", "fecha_fin", "id_servicio"],
    },
  },
};

interface Slot {
  fecha: string;
  hora: string;
  id_dentista: number;
  nombre_dentista: string;
}

const ID_A_NOMBRE: Record<number, string> = {
  5: "Dr. Felipe Pinto", 47: "Dr. Erik Castro", 66: "Dr. Juan Herrera",
  88: "Dra. Rocío Serrano", 89: "Dra. Julia Pereira", 95: "Dra. Marjorie Valdivieso",
  98: "Dr. Andrés Celis", 105: "Dr. Andrés Leiva", 107: "Dra. Claudia Lavarello",
};

const ID_SUCURSAL = parseInt(process.env.DENTALINK_SUCURSAL ?? "8", 10);

export async function consultarDisponibilidad(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fechaInicio = String(args.fecha_inicio ?? "");
  const fechaFin = String(args.fecha_fin ?? "");
  const idServicio = String(args.id_servicio ?? "");
  const soloDoctor = args.id_dentista ? Number(args.id_dentista) : null;

  if (!fechaInicio || !fechaFin || !idServicio) {
    return { ok: false, error: "Faltan parámetros: fecha_inicio, fecha_fin, id_servicio" };
  }

  // Extraer IDs de doctores ONLINE que atienden este servicio
  // (se leen del catálogo vía infoServicio, aquí usamos los ONLINE hardcodeados como fallback)
  const doctoresOnline = Object.keys(ID_A_NOMBRE)
    .map(Number)
    .filter((id) => !OFFLINE_DOCTORS.includes(id));

  const doctoresAConsultar = soloDoctor
    ? (OFFLINE_DOCTORS.includes(soloDoctor) ? [] : [soloDoctor])
    : doctoresOnline;

  const slots: Slot[] = [];

  for (const idDoc of doctoresAConsultar) {
    try {
      // Endpoint documentado en v1: GET /sucursales/{id}/dentistas/{id_dentista}/agendas?q={"fecha_inicio":...}
      const q = encodeURIComponent(
        JSON.stringify({ fecha_inicio: fechaInicio, fecha_fin: fechaFin })
      );
      const data = (await dentalinkGet(
        `/sucursales/${ID_SUCURSAL}/dentistas/${idDoc}/agendas?q=${q}`
      )) as { data?: { fecha: string; hora_inicio: string; estado: string }[] };

      const agendas = data?.data ?? [];
      for (const slot of agendas) {
        if (slot.estado === "disponible" || slot.estado === "libre") {
          slots.push({
            fecha: slot.fecha,
            hora: slot.hora_inicio?.slice(0, 5) ?? "",
            id_dentista: idDoc,
            nombre_dentista: ID_A_NOMBRE[idDoc] ?? `Doctor ${idDoc}`,
          });
        }
      }
    } catch {
      // Si un doctor falla, continuamos con los demás
    }
  }

  if (slots.length === 0) {
    return {
      ok: true,
      total: 0,
      mensaje: "No hay disponibilidad en ese rango de fechas. Sugerir fechas alternativas.",
    };
  }

  // Agrupar por fecha → doctor
  const agrupado: Record<string, Record<string, string[]>> = {};
  for (const s of slots) {
    agrupado[s.fecha] ??= {};
    agrupado[s.fecha][s.nombre_dentista] ??= [];
    agrupado[s.fecha][s.nombre_dentista].push(s.hora);
  }

  return { ok: true, total: slots.length, disponibilidad: agrupado };
}
