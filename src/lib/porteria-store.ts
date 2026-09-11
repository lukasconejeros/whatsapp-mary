// Dónde se guardan las fichas de la portería del login.
//
// Base propia (`data/porteria.db`), NO la de los mensajes: así un error acá no puede tocar ni una
// ficha de paciente. Va en disco y no en memoria a propósito — el punto del segundo nivel es que el
// cierre aguante un reinicio del contenedor; si viviera en memoria, apretar Implementar en EasyPanel
// reabriría la puerta al que estaba probando claves.

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { type Ficha, fichaNueva } from "./porteria";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "porteria.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS intentos_login (
  quien      TEXT PRIMARY KEY,
  fallos     INTEGER NOT NULL DEFAULT 0,
  ultimo     INTEGER NOT NULL DEFAULT 0,
  codigo     TEXT,
  cerrada_en INTEGER
);
`;

let db: Database.Database | null = null;

function conexion(): Database.Database {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

type Fila = { quien: string; fallos: number; ultimo: number; codigo: string | null; cerrada_en: number | null };

const aFicha = (f: Fila): Ficha => ({
  fallos: f.fallos,
  ultimo: f.ultimo,
  codigo: f.codigo,
  cerradaEn: f.cerrada_en,
});

export function leerFicha(quien: string): Ficha | undefined {
  const f = conexion().prepare("SELECT * FROM intentos_login WHERE quien = ?").get(quien) as Fila | undefined;
  return f ? aFicha(f) : undefined;
}

export function guardarFicha(quien: string, ficha: Ficha): void {
  conexion()
    .prepare(
      `INSERT INTO intentos_login (quien, fallos, ultimo, codigo, cerrada_en) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(quien) DO UPDATE SET fallos = excluded.fallos, ultimo = excluded.ultimo,
         codigo = excluded.codigo, cerrada_en = excluded.cerrada_en`,
    )
    .run(quien, ficha.fallos, ficha.ultimo, ficha.codigo, ficha.cerradaEn);
}

/** Entró bien (o se reactivó): se le borra el historial. */
export function borrarFicha(quien: string): void {
  conexion().prepare("DELETE FROM intentos_login WHERE quien = ?").run(quien);
}

/**
 * Reactiva con el código. Devuelve true solo si el código calza con una puerta realmente cerrada.
 * Comparación de largo fijo para no filtrar por el tiempo de respuesta cuántos dígitos acertó.
 */
export function reactivarConCodigo(codigo: string): boolean {
  const limpio = codigo.replace(/\D/g, "");
  if (limpio.length !== 6) return false;
  const cerradas = conexion()
    .prepare("SELECT * FROM intentos_login WHERE cerrada_en IS NOT NULL")
    .all() as Fila[];
  let acerto = false;
  for (const f of cerradas) {
    if (f.codigo && f.codigo.length === limpio.length && iguales(f.codigo, limpio)) acerto = true;
  }
  if (acerto) conexion().prepare("DELETE FROM intentos_login WHERE cerrada_en IS NOT NULL").run();
  return acerto;
}

/** Compara sin cortar en el primer dígito distinto. */
function iguales(a: string, b: string): boolean {
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** Cuántas direcciones distintas están cerradas ahora mismo (para distinguir un ataque de un despiste). */
export function cuantasCerradas(): number {
  const r = conexion()
    .prepare("SELECT COUNT(*) AS n FROM intentos_login WHERE cerrada_en IS NOT NULL")
    .get() as { n: number };
  return r.n;
}

/** Limpia las fichas viejas sin cerrar, para que la tabla no crezca sin fin. */
export function barrerCaducadas(antesDe: number): void {
  conexion().prepare("DELETE FROM intentos_login WHERE cerrada_en IS NULL AND ultimo < ?").run(antesDe);
}

export { fichaNueva };
