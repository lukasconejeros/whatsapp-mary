// Tool: info_servicio_completa
// Lee el catálogo de servicios desde Google Sheets (con caché en memoria 10 min)

interface Servicio {
  id_servicio: string;
  nombre: string;
  categoria: "VERDE" | "AMARILLO" | "ROJO";
  agendable_bot: "SI" | "NO" | "CONSULTA";
  id_dentista_default: string; // CSV de IDs
  precio_referencia?: string;
  duracion_min?: number;
  notas?: string;
}

let _cache: Servicio[] | null = null;
let _cacheTs = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

async function fetchCatalogo(): Promise<Servicio[]> {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL) return _cache;

  const sheetId = process.env.SHEETS_CATALOG_ID;
  if (!sheetId) throw new Error("Falta SHEETS_CATALOG_ID en .env.local");

  // Leer el sheet como CSV público (debe estar publicado como CSV)
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Servicios`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Error leyendo catálogo: ${resp.status}`);

  const csv = await resp.text();
  const rows = csv.trim().split("\n");
  if (rows.length < 2) return [];

  const headers = rows[0].split(",").map((h) => h.replace(/"/g, "").trim().toLowerCase());

  const servicios: Servicio[] = rows.slice(1).map((row) => {
    // CSV puede tener comas dentro de comillas — parse simple
    const cols = row.match(/("([^"]*)"|([^,]*))(,|$)/g)
      ?.map((c) => c.replace(/^"|"$|,$|^,/g, "").trim()) ?? [];

    const get = (key: string) => cols[headers.indexOf(key)] ?? "";

    return {
      id_servicio: get("id_servicio") || get("id"),
      nombre: get("nombre") || get("servicio"),
      categoria: (get("categoria") || "VERDE") as Servicio["categoria"],
      agendable_bot: (get("agendable_bot") || "SI") as Servicio["agendable_bot"],
      id_dentista_default: get("id_dentista_default") || get("dentistas"),
      precio_referencia: get("precio_referencia") || get("precio"),
      duracion_min: parseInt(get("duracion_min") || "30", 10),
      notas: get("notas"),
    };
  }).filter((s) => s.id_servicio);

  _cache = servicios;
  _cacheTs = now;
  return servicios;
}

// Fuzzy search: keyword puede ser nombre, id, o sinónimo
function buscar(keyword: string, servicios: Servicio[]): Servicio[] {
  const kw = keyword.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Sinónimos comunes
  const SINONIMOS: Record<string, string> = {
    tapadura: "restauracion", relleno: "restauracion", tapar: "restauracion",
    nervio: "endodoncia", muela: "endodoncia", conducto: "endodoncia",
    limpieza: "profilaxis", sarro: "profilaxis", manchas: "profilaxis",
    rayos: "radiografia", rx: "radiografia", placa: "radiografia", panoramica: "radiografia",
    colmillo: "exodoncia", muela_juicio: "exodoncia", extraccion: "exodoncia",
    funda: "corona", diente_roto: "corona",
    frenos: "ortodoncia", alineadores: "ortodoncia", brackets: "ortodoncia",
    evaluacion: "consulta", revision: "consulta", control: "consulta",
    encias: "periodoncia", raspaje: "periodoncia", destartraje: "periodoncia",
    implante: "implantologia",
    blanqueamiento: "blanqueamiento", whitening: "blanqueamiento",
  };

  const kwNorm = SINONIMOS[kw.replace(/\s+/g, "_")] ?? kw;

  return servicios.filter((s) => {
    const nombre = s.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const id = s.id_servicio.toLowerCase();
    return (
      nombre.includes(kwNorm) ||
      id === kwNorm ||
      nombre.includes(kw) ||
      id.includes(kw)
    );
  }).slice(0, 5);
}

export const infoServicioDefinition = {
  type: "function" as const,
  function: {
    name: "info_servicio_completa",
    description:
      "Busca un servicio en el catálogo (274 servicios) por palabra clave. Devuelve nombre, categoría (VERDE=agendable, ROJO=derivar), doctores que lo atienden, y si el bot puede agendarlo. Llamar SIEMPRE antes de decir cualquier cosa sobre un tratamiento.",
    parameters: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description: "Palabra clave del servicio. Ej: 'consulta', 'limpieza', 'extraccion', 'brackets'.",
        },
        id_dentista: {
          type: "number",
          description: "ID del doctor (opcional). Si se pasa, filtra resultados por ese doctor.",
        },
      },
      required: ["keyword"],
    },
  },
};

export async function infoServicio(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const keyword = String(args.keyword ?? "").trim();
  const idDentista = args.id_dentista ? Number(args.id_dentista) : null;

  if (!keyword) return { ok: false, error: "keyword requerida" };

  let servicios: Servicio[];
  try {
    servicios = await fetchCatalogo();
  } catch (e) {
    return { ok: false, error: String(e) };
  }

  let resultados = buscar(keyword, servicios);

  if (idDentista) {
    resultados = resultados.filter((s) =>
      s.id_dentista_default.split(",").map((x) => x.trim()).includes(String(idDentista))
    );
  }

  if (resultados.length === 0) {
    return {
      ok: true,
      total: 0,
      mensaje: `No se encontró servicio con '${keyword}'. Intenta con sinónimo o describe el tratamiento.`,
    };
  }

  return {
    ok: true,
    total: resultados.length,
    servicios: resultados.map((s) => ({
      id_servicio: s.id_servicio,
      nombre: s.nombre,
      categoria: s.categoria,
      agendable_bot: s.agendable_bot,
      requiere_derivacion: s.categoria === "ROJO" || s.agendable_bot !== "SI",
      doctores_atienden: s.id_dentista_default,
      duracion_min: s.duracion_min,
      precio_referencia: s.precio_referencia,
    })),
  };
}
