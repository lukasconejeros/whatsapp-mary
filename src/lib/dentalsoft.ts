// Cliente Dentalsoft (Clínica Mónaco) — OAuth client_credentials + helpers de agenda.
// API distinta de Dentalink. Doc: https://api.dentalsoft.cl/external_docs/

const BASE = process.env.DENTALSOFT_BASE ?? "https://api.dentalsoft.cl/external";

// Profesionales Mónaco: id = RUT numérico sin DV
export const PROFESIONALES_MONACO: Record<number, string> = {
  18132867: "Franco De La Rosa Navarro",
  18644066: "Gonzalo Durán Alarcón",
  18841227: "Sebastián Balocchi Peña",
  18854463: "Matías Collao Ullao",
  19422116: "Claudio Ignacio Barriga Sanhueza",
  19554769: "Carolina Delgado Vargas",
  20160837: "Sofía Guzmán Solís",
};

export const SUCURSAL_MONACO = 2; // Carampangue (Valdivia)

// Estados de cita Dentalsoft
export const ESTADOS_CITA: Record<number, string> = {
  0: "Agendada", 1: "En lista de espera", 2: "Confirmada", 3: "Ingresada a box",
  4: "Cancelada", 5: "Atendida", 6: "Notificada email", 7: "Confirmada email",
  8: "Notificada whatsapp", 9: "Confirmada whatsapp",
};

// ── Token OAuth con cache (dura 24h, refrescamos a las 23h) ──────────
let _token: string | null = null;
let _tokenExp = 0;

export async function getToken(): Promise<string> {
  const now = Date.now();
  if (_token && now < _tokenExp) return _token;

  const clientId = process.env.DENTALSOFT_CLIENT_ID;
  const clientSecret = process.env.DENTALSOFT_CLIENT_SECRET;
  const scope = process.env.DENTALSOFT_SCOPE; // RUT clínica sin guión ni DV
  if (!clientId || !clientSecret || !scope) {
    throw new Error("Faltan credenciales Dentalsoft en .env.local (DENTALSOFT_CLIENT_ID/SECRET/SCOPE)");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const res = await fetch(`${BASE}/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Dentalsoft auth → ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _token = data.access_token;
  _tokenExp = now + (data.expires_in - 3600) * 1000; // refresca 1h antes
  return _token;
}

export async function dsFetch(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await getToken();
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`Dentalsoft ${method} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// Disponibilidad diaria de un profesional (slots reales).
// Formato: /agenda/disponibilidad/diaria/{idProf}/{YYYY-MM-DD}/{sucursal}/{bloques}
export async function disponibilidadDiaria(
  idProfesional: number,
  fecha: string,
  bloques = 6 // 6 bloques de 5min = 30min
): Promise<unknown> {
  return dsFetch("GET", `/agenda/disponibilidad/diaria/${idProfesional}/${fecha}/${SUCURSAL_MONACO}/${bloques}`);
}

// Disponibilidad mensual (OJO: marca día disponible si hay HORARIO, no si hay slots libres)
export async function disponibilidadMensual(
  idProfesional: number,
  anio: number,
  mes: number,
  bloques = 6
): Promise<unknown> {
  return dsFetch("GET", `/agenda/disponibilidad/mensual/${idProfesional}/${anio}/${mes}/${SUCURSAL_MONACO}/${bloques}`);
}

// Cambiar estado de cita: cancelar | confirmar (string, no id numérico)
export async function cambiarEstadoCita(idCita: number, estado: "cancelar" | "confirmar"): Promise<unknown> {
  return dsFetch("PUT", `/agenda/cita/cambia_estado`, { id: idCita, estado });
}
