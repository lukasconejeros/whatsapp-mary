// Helpers compartidos para Dentalink API

const ID_A_NOMBRE: Record<number, string> = {
  5: "Dr. Felipe Pinto", 47: "Dr. Erik Castro", 66: "Dr. Juan Herrera",
  88: "Dra. Rocío Serrano", 89: "Dra. Julia Pereira", 95: "Dra. Marjorie Valdivieso",
  98: "Dr. Andrés Celis", 105: "Dr. Andrés Leiva", 107: "Dra. Claudia Lavarello",
};
export { ID_A_NOMBRE };

const OFFLINE = [47, 66, 89, 95];
export { OFFLINE };

const ID_SUCURSAL = () => parseInt(process.env.DENTALINK_SUCURSAL ?? "8", 10);

export async function dlFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const base = process.env.DENTALINK_BASE ?? "https://api.dentalink.healthatom.com/api/v1";
  const token = process.env.DENTALINK_TOKEN;
  if (!token) throw new Error("Falta DENTALINK_TOKEN");

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${base}${path}`, opts);
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Dentalink ${method} ${path} → ${resp.status}: ${txt.slice(0, 300)}`);
  }
  return resp.json();
}

// Busca citas próximas de un paciente por su id_paciente
export async function getCitasProximas(
  idPaciente: number,
  diasHorizonte = 30
): Promise<{ id_cita: number; fecha: string; hora: string; id_dentista: number; nombre_dentista: string; id_estado: number; tratamiento: string }[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const hasta = new Date(Date.now() + diasHorizonte * 864e5).toISOString().slice(0, 10);
  const q = encodeURIComponent(JSON.stringify({ fecha: hoy }));

  const data = (await dlFetch(
    "GET",
    `/citas?id_paciente=${idPaciente}&q=${q}`
  )) as { data?: { id: number; fecha: string; hora_inicio: string; id_dentista: number; id_estado: number; id_tratamiento?: number; nombre_tratamiento?: string }[] };

  const citas = (data?.data ?? []).filter((c) => c.fecha >= hoy && c.fecha <= hasta);

  return citas.map((c) => ({
    id_cita: c.id,
    fecha: c.fecha,
    hora: c.hora_inicio?.slice(0, 5) ?? "",
    id_dentista: c.id_dentista,
    nombre_dentista: ID_A_NOMBRE[c.id_dentista] ?? `Doctor ${c.id_dentista}`,
    id_estado: c.id_estado,
    tratamiento: c.nombre_tratamiento ?? "",
  }));
}

// Busca id_paciente en Dentalink por teléfono o RUT
export async function buscarPacienteDentalink(opts: {
  phone?: string;
  rut?: string;
}): Promise<{ id_paciente: number; nombre: string; rut: string } | null> {
  try {
    let path = "";
    if (opts.phone) {
      const clean = opts.phone.replace(/\D/g, "");
      path = `/pacientes?q=${encodeURIComponent(JSON.stringify({ celular: clean }))}`;
    } else if (opts.rut) {
      path = `/pacientes?q=${encodeURIComponent(JSON.stringify({ rut: opts.rut.toUpperCase() }))}`;
    } else return null;

    const data = (await dlFetch("GET", path)) as {
      data?: { id: number; nombre: string; apellido_paterno: string; rut: string }[];
    };
    const p = data?.data?.[0];
    if (!p) return null;
    return {
      id_paciente: p.id,
      nombre: `${p.nombre} ${p.apellido_paterno}`.trim(),
      rut: p.rut,
    };
  } catch {
    return null;
  }
}

// Crea un paciente nuevo en Dentalink
export async function crearPacienteDentalink(opts: {
  nombre: string;
  rut: string;
  phone: string;
}): Promise<number | null> {
  try {
    const [nombre, ...apellidos] = opts.nombre.trim().split(" ");
    const data = (await dlFetch("POST", "/pacientes", {
      nombre,
      apellido_paterno: apellidos[0] ?? "",
      apellido_materno: apellidos[1] ?? "",
      rut: opts.rut.toUpperCase(),
      celular: opts.phone.replace(/\D/g, ""),
      id_sucursal: ID_SUCURSAL(),
    })) as { data?: { id: number } };
    return data?.data?.id ?? null;
  } catch {
    return null;
  }
}

// Detecta si hay cita con OXIDO_PABELLON el mismo día/hora
export async function detectaOxidoPabellon(
  idPaciente: number,
  idCita: number,
  fecha: string,
  hora: string
): Promise<boolean> {
  try {
    const citas = await getCitasProximas(idPaciente);
    return citas.some(
      (c) =>
        c.id_cita !== idCita &&
        c.fecha === fecha &&
        c.hora === hora &&
        c.tratamiento.toUpperCase().includes("OXIDO")
    );
  } catch {
    return false;
  }
}

export { ID_SUCURSAL };
