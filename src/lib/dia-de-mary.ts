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
  pagosFijosDeFecha, listClientes, inscripcionesDeFecha, ausenciasRango,
} from "./db.js";
import { bloquesDelDia, type InscripcionConAlumno } from "./dia-clases.js";

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

  // ── El horario de verdad: los alumnos inscritos ──────────────────────────
  // Una sala por profesora, con la gente que le toca ese día. A quien avisó que
  // no viene se le deja a la vista (para que Mary lo recuerde) pero NO entra al
  // pase de lista: preguntarlo lo dejaría marcado como "faltó" cada semana.
  const inscripciones = inscripcionesDeFecha(fecha).map<InscripcionConAlumno>((i) => ({
    id: i.id, alumnoId: i.alumnoId, nombre: i.nombre, dia: i.dia,
    hora: i.hora, horaFin: i.horaFin, profe: i.profe,
  }));
  const salas = bloquesDelDia(fecha, inscripciones, ausenciasRango(fecha, fecha));
  for (const sala of salas) {
    const nombres = sala.alumnos.map((a) =>
      a.estado === "normal" ? a.nombre : `${a.nombre} (no viene)`
    );
    for (const a of sala.alumnos) if (a.estado === "normal") agregarAlumno(a.nombre);
    items.push({
      hora: sala.hora,
      texto: `${sala.profe ?? "sin profesora"} · ${nombres.length ? nombres.join(", ") : "sin alumnos"}`,
      tipo: "clase",
    });
  }

  // ── Clases que se repiten todas las semanas ──────────────────────────────
  // El modelo viejo (una fila con la lista de nombres dentro). Sigue vivo por si
  // Mary tiene algo cargado ahí; el horario nuevo va arriba, en inscripciones.
  // Una clase fija cuyos alumnos YA están todos en el horario nuevo es la misma
  // clase migrada: se salta, o el mensaje diría el día dos veces. Si trae a alguien
  // que no está inscrito, se manda igual: nadie puede desaparecer del día de Mary.
  const inscritos = new Set(
    salas.flatMap((s) => s.alumnos.map((a) => a.nombre.trim().toLowerCase()))
  );
  for (const f of clasesFijasDeFecha(fecha)) {
    const nombres = f.alumnos.filter(Boolean);
    if (nombres.length > 0 && nombres.every((n) => inscritos.has(n.trim().toLowerCase()))) continue;
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
