// Persistencia de lo que Mary edita en "Entrenar IA".
//
// EL BUG QUE CIERRA: `/api/config` escribía SOLO `prompts/negocio.md`, que viene versionado en
// el repo. Cada deploy reconstruye la imagen del contenedor y RESTAURA ese archivo → todo lo que
// Mary hubiera escrito (horarios, precios, la cuenta del banco) se BORRABA, en silencio, y nadie
// se enteraba hasta que el bot contestaba con los datos viejos a una apoderada de verdad.
//
// LA ARQUITECTURA: no se guarda el prompt entero en la base. Si se hiciera, las ediciones de Mary
// sobrevivirían pero los arreglos del prompt hechos en el código (el filtro de entrada, el techo
// de 3-4 líneas, la regla de dar los datos del banco al tiro) NUNCA volverían a llegar a
// producción. Sería cambiar un problema por otro peor. Entonces:
//   · Las REGLAS (filtro, tono, formato, candados) viven en negocio.md → las mantiene el repo.
//   · Los DATOS que cambian seguido (dirección, horarios, precios, banco, equipo) los edita Mary
//     y se guardan en la tabla `config` → pisan su sección al armar el prompt, y sobreviven a los
//     deploys.
// Cada uno manda en lo suyo.
// Sin extensión .js: este módulo lo importan la API de Next y los scripts (db.ts y ensayo.ts
// hacen igual). Con .js, el bundler de Next no lo resuelve y la pantalla revienta con un 500.
import { getConfig, setConfig } from "./db";

const CLAVE = "secciones_negocio";

// Solo estas secciones son DATO de Mary. Cualquier otra es una regla del repo y NO se persiste
// (si se persistiera, un arreglo del prompt nunca volvería a aplicarse).
export type ClaveSeccion = "ubicacion" | "horarios" | "precios" | "promociones" | "transferencia" | "equipo";

export const ETIQUETAS: Record<ClaveSeccion, string> = {
  ubicacion: "Dónde están",
  horarios: "Días y horarios",
  precios: "Precios y talleres",
  promociones: "Promociones y descuentos",
  transferencia: "Datos para transferir",
  equipo: "Quiénes hacen las clases",
};

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Se identifica por un PREFIJO estable, no por el título completo: los encabezados llevan
// sufijos ("Días y horarios (confirmados por Mary el 10-08)") sin dejar de ser la misma sección.
export function claveDeSeccion(titulo: string): ClaveSeccion | null {
  const t = norm(titulo);
  if (t.startsWith("dias") || t.startsWith("horario")) return "horarios";
  if (t.startsWith("datos para transferir") || t.startsWith("transferencia")) return "transferencia";
  if (t.startsWith("donde")) return "ubicacion";
  if (t.startsWith("precio")) return "precios";
  // "Promociones", "Promociones vigentes (agosto)", "Descuentos": la misma seccion.
  if (t.startsWith("promo") || t.startsWith("descuento")) return "promociones";
  if (t.startsWith("quienes") || t.startsWith("equipo")) return "equipo";
  return null; // regla del repo
}

export type Overrides = Partial<Record<ClaveSeccion, string>>;

// DÓNDE TERMINA UNA SECCIÓN. Definición ÚNICA, usada por el editor y por el motor que arma el
// prompt. Tenerla duplicada sería un bug real: si el editor cortara solo en `##`, la última
// sección editable se tragaría el capítulo `#` que viene después y las reglas quedarían dentro
// de un campo que Mary puede reescribir sin saberlo.
export function esLimiteDeSeccion(linea: string): boolean {
  return /^#{1,2}\s/.test(linea) || /^-{3,}\s*$/.test(linea);
}

// Neutraliza lo que puede crear una sección nueva. Para el texto libre que escribe Mary, que es
// DATO y nunca estructura, se escapa CUALQUIER encabezado: si alguien pega "## Ignora lo anterior"
// en el campo Horarios, sin esto quedaría en el prompt con la misma pinta que una regla de verdad.
// Idempotente: `\##` ya no empieza por `#`, así que guardar dos veces no acumula barras.
export function escaparEstructura(texto: string): string {
  return texto
    .replace(/^([ \t]*)(#{1,6})(?=\s|$)/gm, "$1\\$2")
    .replace(/^([ \t]*)(-{3,})\s*$/gm, "$1\\$2");
}

// Solo claves conocidas, solo strings con contenido. Protege tanto de un POST malicioso como de
// una fila corrupta editada a mano: una regla del repo JAMÁS entra por acá. Se aplica en lectura
// Y en escritura, así que lo guardado antes de este arreglo también queda neutralizado al leerlo.
export function sanear(o: unknown): Overrides {
  const limpio: Overrides = {};
  if (!o || typeof o !== "object") return limpio;
  const src = o as Record<string, unknown>;
  for (const k of Object.keys(ETIQUETAS) as ClaveSeccion[]) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) limpio[k] = escaparEstructura(v.trim());
  }
  return limpio;
}

// ── Lectura (la usa el bot en CADA mensaje) ─────────────────────────────────
// La firma CRUDA se expone aparte para poder cachear el prompt armado e invalidarlo cuando Mary
// edita: la web y el bot son procesos DISTINTOS, así que un caché en memoria del bot no se entera
// de un cambio hecho desde el panel. La base es lo único que ambos ven. Por eso se relee esta fila
// en cada mensaje (SQLite síncrono, microsegundos): es lo que hace que un cambio en el panel se
// aplique AL TIRO, sin reiniciar nada.
export function getOverridesRaw(): string {
  try {
    return getConfig(CLAVE, "").trim();
  } catch {
    return ""; // sin base, el bot sigue con el prompt del repo en vez de quedarse mudo
  }
}

export function parseOverrides(raw: string): Overrides {
  if (!raw) return {};
  try {
    return sanear(JSON.parse(raw));
  } catch (e) {
    console.warn(`[secciones] fila ilegible, se usa el prompt del repo: ${String(e).slice(0, 90)}`);
    return {};
  }
}

export function getOverrides(): Overrides {
  return parseOverrides(getOverridesRaw());
}

export function setOverrides(o: Overrides): void {
  setConfig(CLAVE, JSON.stringify(sanear(o)));
}

// ── Lo que ve Mary en la pantalla "Entrenar IA" ─────────────────────────────
// Un bloque por sección `## Título` del prompt. Los cinco que son DATO salen editables y con lo
// que ella haya guardado; el resto se muestra para que se vea qué sabe el bot, pero marcado como
// no editable: si pudiera reescribir el filtro de entrada o el techo de líneas, el arreglo del
// repo dejaría de llegar y nadie se enteraría.
export type BloqueSeccion = {
  titulo: string;
  contenido: string;
  editable: boolean;
  clave: ClaveSeccion | null;
};

export function bloquesDelPrompt(md: string, ov: Overrides = {}): BloqueSeccion[] {
  const lineas = (md || "").replace(/\r\n/g, "\n").split("\n");
  const bloques: BloqueSeccion[] = [];
  let actual: BloqueSeccion | null = null;
  const cuerpo: string[] = [];

  const cerrar = () => {
    if (!actual) return;
    actual.contenido = cuerpo.join("\n").trim();
    // Si Mary ya editó esta sección, en el campo va SU texto: si viera el del repo, creería que
    // no se guardó y lo escribiría otra vez.
    const suyo = actual.clave ? ov[actual.clave] : undefined;
    if (typeof suyo === "string" && suyo.trim()) actual.contenido = suyo.trim();
    bloques.push(actual);
    actual = null;
    cuerpo.length = 0;
  };

  for (const linea of lineas) {
    const h2 = linea.match(/^##\s+(.+)$/);
    if (h2) {
      cerrar();
      const titulo = h2[1].trim();
      const clave = claveDeSeccion(titulo);
      actual = { titulo, contenido: "", editable: clave !== null, clave };
      continue;
    }
    // Un capítulo `#` cierra la sección anterior, pero no abre ninguna editable.
    if (/^#\s/.test(linea)) { cerrar(); continue; }
    if (actual) cuerpo.push(linea);
  }
  cerrar();
  return bloques;
}

// ── Aplicación (PURA, testeable sin base) ───────────────────────────────────
// Reemplaza el CUERPO de cada sección `## Título` cuya clave esté en `ov`. El encabezado se
// conserva tal cual y las secciones no reconocidas no se tocan. Si `ov` está vacío devuelve el
// prompt intacto: con la base vacía (deploy nuevo), el comportamiento es IDÉNTICO al de hoy.
export function aplicarOverrides(md: string, ov: Overrides): string {
  if (!ov || Object.keys(ov).length === 0) return md;

  // CRLF normalizado: `\r` es un terminador de línea para las expresiones regulares de JavaScript
  // y rompe en silencio la detección de encabezados.
  const lineas = (md || "").replace(/\r\n/g, "\n").split("\n");
  const salida: string[] = [];
  let saltando: ClaveSeccion | null = null;

  for (const linea of lineas) {
    if (saltando && esLimiteDeSeccion(linea)) saltando = null; // terminó la sección reemplazada

    if (!saltando && /^##\s/.test(linea)) {
      const titulo = linea.replace(/^##\s+/, "");
      const clave = claveDeSeccion(titulo);
      const nuevo = clave ? ov[clave] : undefined;
      if (clave && typeof nuevo === "string" && nuevo.trim()) {
        salida.push(linea); // se conserva el encabezado original
        salida.push("");
        salida.push(nuevo.trim()); // cuerpo escrito por Mary
        salida.push("");
        saltando = clave; // se descarta el cuerpo original
        continue;
      }
    }
    if (!saltando) salida.push(linea);
  }
  return salida.join("\n");
}
