// Todo lo que Mary tiene una fecha concreta, en una sola lista: es lo que le
// llega por WhatsApp a las 10:00 y de donde sale la lista de alumnos a los que
// se les pasa lista a las 21:00.
//
// Junta las mismas cuatro fuentes que muestra el calendario del panel, para que
// el mensaje y la pantalla nunca digan cosas distintas:
//   clases fijas (se repiten cada semana) · eventos puntuales · recordatorios
//   que ella escribió · pagos fijos que caen ese día.
import {
  clasesFijasDeFecha, listClasesRange, recordatoriosDeFecha,
  pagosFijosDeFecha, listClientes,
} from "./db.js";

export interface ItemDia {
  hora: string | null; // "HH:MM"
  texto: string;
  tipo: "clase" | "recordatorio" | "pago";
}
export interface DiaDeMary {
  items: ItemDia[];
  /** Nombres únicos, en el orden en que aparecen en el día. */
  alumnos: string[];
}

/** Minutos desde medianoche; sin hora va al final del día. */
function orden(hora: string | null): number {
  if (!hora) return 99_999;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!m) return 99_999;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function plata(monto: number): string {
  return `$${monto.toLocaleString("es-CL")}`;
}

export function armarDia(fecha: string): DiaDeMary {
  const items: ItemDia[] = [];
  const alumnos: string[] = [];
  const agregarAlumno = (nombre: string) => {
    const n = nombre.trim();
    if (n && !alumnos.includes(n)) alumnos.push(n);
  };

  // ── Clases que se repiten todas las semanas ──────────────────────────────
  for (const f of clasesFijasDeFecha(fecha)) {
    const nombres = f.alumnos.filter(Boolean);
    nombres.forEach(agregarAlumno);
    items.push({
      hora: f.hora,
      texto: `${f.profe} · ${nombres.length ? nombres.join(", ") : "sin alumnos"}`,
      tipo: "clase",
    });
  }

  // ── Eventos puntuales de esa fecha ───────────────────────────────────────
  // Sus alumnos son ids de `clientes` (o texto suelto), así que hay que
  // traducirlos a nombre: es lo único que Mary reconoce por WhatsApp.
  const porId = new Map(listClientes().map((c) => [c.id, (c.nombre ?? "").trim()]));
  for (const c of listClasesRange(fecha, fecha)) {
    const nombres = c.alumnos
      .map((a) => (typeof a === "number" ? porId.get(a) ?? `#${a}` : String(a)))
      .filter((n) => n.trim().length > 0);
    nombres.forEach(agregarAlumno);
    const texto = nombres.length
      ? `${c.profe} · ${nombres.join(", ")}`
      : c.nota?.trim() || c.profe;
    items.push({ hora: c.hora, texto, tipo: "clase" });
  }

  // ── Los recordatorios que ella misma escribió ────────────────────────────
  for (const r of recordatoriosDeFecha(fecha)) {
    if (r.hecho) continue; // ya lo dio por hecho: no se le repite
    items.push({ hora: r.hora, texto: r.texto.trim(), tipo: "recordatorio" });
  }

  // ── Pagos fijos que caen ese día ─────────────────────────────────────────
  for (const p of pagosFijosDeFecha(fecha)) {
    const nombre = p.tipo === "otros" ? p.descripcion?.trim() || "otro pago" : p.tipo;
    items.push({ hora: null, texto: `${nombre} ${plata(p.monto)}`, tipo: "pago" });
  }

  items.sort((a, b) => orden(a.hora) - orden(b.hora));
  return { items, alumnos };
}
