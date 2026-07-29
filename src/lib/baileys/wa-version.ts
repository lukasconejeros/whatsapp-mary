// QUÉ VERSIÓN DE WHATSAPP WEB ANUNCIA EL BOT AL CONECTARSE.
//
// Lección del 28-jul-2026: WhatsApp dejó de aceptar la versión que Baileys trae de fábrica (y también la
// que servía su fuente remota) y respondió `code 405` en cada intento de conexión, en todo el mundo. El
// arranque pedía la versión vigente a internet EN CADA RECONEXIÓN — y como el reintento es cada pocos
// segundos, esa petición se hacía sin parar hasta que la cortaban. Al fallar caía a la de fábrica → 405 →
// reconectar → repetir. Un bucle que se alimenta solo: sin QR, sin conexión y sin salir de ahí ni reiniciando.
//
// Aquí la versión se resuelve por capas, de más fiable a más desesperada:
//   1. WA_VERSION del entorno — escotilla para arreglar en caliente sin tocar ni desplegar código.
//   2. Memoria del proceso (6h) — evita machacar la red en cada reintento. ES LO QUE ROMPE EL BUCLE.
//   3. Red (fetchLatestWaWebVersion, la fuente VIVA de WhatsApp; el JSON de Baileys de respaldo), máx 1/min.
//   4. Disco (data/wa-version.json) — lo último que funcionó, sobrevive a los reinicios.
//   5. Fallback fijo, más nuevo que el de fábrica.
// Y nunca se retrocede: entre dos candidatas gana SIEMPRE la más nueva.
//
// Portado de whatsapp-monaco (Medifis, commit 705eddb), donde ya está probado.
import fs from "fs";
import path from "path";
import { fetchLatestBaileysVersion, fetchLatestWaWebVersion } from "@whiskeysockets/baileys";

export type VersionWA = [number, number, number];

// Versión verificada por sonda la noche del 28-jul-2026: WhatsApp rechazaba con 405 todo lo anterior
// (incluida la 1035194821 que aún servía la fuente remota) y con ESTA volvió a aceptar el registro.
// Solo se usa si el entorno, la red y el disco fallan; es el suelo, no el techo: como nunca se retrocede,
// si la red trae una más nueva, gana la de la red.
export const FALLBACK_WA_VERSION: VersionWA = [2, 3000, 1037641644];

const TTL_MEMORIA_MS = 6 * 60 * 60 * 1000; // 6h: WhatsApp no cambia de versión cada minuto
export const MIN_MS_ENTRE_CONSULTAS = 60_000; // nunca más de una consulta a la red por minuto

const DATA_DIR = path.resolve(process.cwd(), "data");
const ARCHIVO_CACHE = path.join(DATA_DIR, "wa-version.json");

export interface MemoriaVersion { version: VersionWA; ts: number }

export interface DepsVersion {
  env: string | undefined;
  ahora: number;
  fetchRemota: () => Promise<VersionWA>;
  leerCache: () => unknown;
  guardarCache: (v: VersionWA) => void;
  memoria: MemoriaVersion | null;
  ultimoIntento?: number;
}

export interface ResultadoVersion {
  version: VersionWA;
  origen: "env" | "memoria" | "red" | "disco" | "fallback";
  consultoRed: boolean;
}

// Acepta [2,3000,123], "2.3000.123" y lo que venga del JSON del disco. Todo lo demás → null.
export function parsearVersion(v: unknown): VersionWA | null {
  const partes = typeof v === "string" ? v.split(".") : v;
  if (!Array.isArray(partes) || partes.length !== 3) return null;
  const nums = partes.map((p) => (typeof p === "number" ? p : typeof p === "string" ? Number(p) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0)) return null;
  const [major, minor] = nums as VersionWA;
  if (major < 2 || minor < 1000) return null; // una versión de WhatsApp Web no es [0,1,1]
  return nums as VersionWA;
}

export function esMasNueva(a: VersionWA, b: VersionWA): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

// Elige la más nueva de las dos; si una es nula, la otra.
function mejor(a: VersionWA | null, b: VersionWA | null): VersionWA | null {
  if (!a) return b;
  if (!b) return a;
  return esMasNueva(a, b) ? a : b;
}

// Lógica pura y testeable: no toca fs, ni red, ni reloj. Todo entra por `deps`.
export async function resolverVersionWA(deps: DepsVersion): Promise<ResultadoVersion> {
  // 1. el entorno manda: arreglo en caliente sin desplegar
  const delEntorno = parsearVersion(deps.env);
  if (delEntorno) return { version: delEntorno, origen: "env", consultoRed: false };

  // 2. memoria fresca: ni una petición más. Esto es lo que impide el bucle de cada pocos segundos.
  if (deps.memoria && deps.ahora - deps.memoria.ts < TTL_MEMORIA_MS) {
    return { version: deps.memoria.version, origen: "memoria", consultoRed: false };
  }

  // 3. red, como mucho una vez por minuto
  const puedeConsultar = deps.ultimoIntento === undefined || deps.ahora - deps.ultimoIntento >= MIN_MS_ENTRE_CONSULTAS;
  let deRed: VersionWA | null = null;
  let consultoRed = false;
  if (puedeConsultar) {
    consultoRed = true;
    try {
      deRed = parsearVersion(await deps.fetchRemota());
    } catch {
      deRed = null; // sin red: seguimos por disco/fallback, nunca por la de fábrica
    }
  }

  // 4. disco: lo último que funcionó de verdad
  let deDisco: VersionWA | null = null;
  try {
    deDisco = parsearVersion(deps.leerCache());
  } catch {
    deDisco = null; // disco ilegible o corrupto: se ignora, no rompe el arranque
  }

  // La red solo se guarda si aporta algo más nuevo que lo ya guardado.
  if (deRed && (!deDisco || esMasNueva(deRed, deDisco))) {
    try { deps.guardarCache(deRed); } catch { /* si no se puede escribir, seguimos igual */ }
  }

  // 5. gana la más nueva de las tres; el fallback es el suelo
  const ganadora = mejor(mejor(deRed, deDisco), FALLBACK_WA_VERSION) as VersionWA;
  // El origen se decide por VALOR, no por referencia: cuando la red devuelve exactamente la misma versión
  // que el fallback (lo normal cuando el fallback está al día) el mérito es de la red, que sí respondió.
  const mismaQue = (v: VersionWA | null) => !!v && !esMasNueva(v, ganadora) && !esMasNueva(ganadora, v);
  const origen: ResultadoVersion["origen"] =
    mismaQue(deRed) ? "red" : mismaQue(deDisco) ? "disco" : "fallback";
  return { version: ganadora, origen, consultoRed };
}

// ── envoltorio con el estado real del proceso (memoria + disco + red) ──

let memoria: MemoriaVersion | null = null;
let ultimoIntento: number | undefined;

/** Resuelve la versión a anunciar. Seguro de llamar en cada reconexión: no machaca la red. */
export async function obtenerVersionWA(): Promise<{ version: VersionWA; origen: string }> {
  const r = await resolverVersionWA({
    env: process.env.WA_VERSION,
    ahora: Date.now(),
    // La fuente VIVA primero (web.whatsapp.com, lo que WhatsApp exige HOY); el JSON del repo de Baileys
    // solo de respaldo: la noche del 28-jul sirvió una versión ya rechazada durante horas.
    fetchRemota: async () => {
      try {
        return (await fetchLatestWaWebVersion({})).version as VersionWA;
      } catch {
        return (await fetchLatestBaileysVersion()).version as VersionWA;
      }
    },
    leerCache: () => {
      if (!fs.existsSync(ARCHIVO_CACHE)) return null;
      return (JSON.parse(fs.readFileSync(ARCHIVO_CACHE, "utf8")) as { version?: unknown }).version;
    },
    guardarCache: (v) => {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(ARCHIVO_CACHE, JSON.stringify({ version: v, guardada: new Date().toISOString() }), "utf8");
    },
    memoria,
    ultimoIntento,
  });
  if (r.consultoRed) ultimoIntento = Date.now();
  // Solo se memoriza lo que vino de fuera; el fallback no se memoriza para poder mejorarlo en el próximo intento.
  if (r.origen === "red" || r.origen === "disco" || r.origen === "env") memoria = { version: r.version, ts: Date.now() };
  return { version: r.version, origen: r.origen };
}

/** Olvida la versión memorizada: se usa cuando WhatsApp responde 405 (versión rechazada) para volver a
 *  preguntar en la siguiente reconexión, respetando igualmente el mínimo de un minuto entre consultas. */
export function olvidarVersionWA(): void {
  memoria = null;
}
