// Planificador de los recordatorios del calendario de Arteluk. Cada pocos
// minutos revisa lo agendado y manda el push que corresponda: el resumen de la
// víspera (20:00) y el aviso 5 h antes de cada horario. Marca lo enviado para
// no repetirlo. Mismo patrón que seguimiento-loop.ts.
//
// Vive en el proceso del BOT, pero no depende de WhatsApp: son avisos Web Push
// al teléfono de Mary y salen aunque el QR no esté escaneado.
import pino from "pino";
import { listClasesRange, marcarAviso5h, getConfig, setConfig, type Clase } from "./db.js";
import { enviarPush, pushConfigurado } from "./push.js";
import { recordatoriosPendientes, diasEntre, type FilaCalendario } from "./recordatorios.js";
import { todaySantiago, nowSantiago } from "./fechas.js";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

/** Cada cuánto se revisa el calendario. 5 min: llega a tiempo y cuesta nada. */
export const INTERVALO_MS = 5 * 60_000;

/** Clave en `config` que recuerda de qué días ya salió el resumen. */
const CLAVE_RESUMEN = "aviso_resumen_enviado";

let timer: ReturnType<typeof setTimeout> | null = null;
let corriendo = false;

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fechas cuyo resumen ya salió. Se guardan como lista separada por comas. */
function resumenesEnviados(): Set<string> {
  const raw = getConfig(CLAVE_RESUMEN, "");
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

/** Anota una fecha más y poda lo viejo (no tiene sentido arrastrar historial). */
function anotarResumen(fecha: string, hoy: string): void {
  const set = resumenesEnviados();
  set.add(fecha);
  const vigentes = [...set].filter((f) => Math.abs(diasEntre(hoy, f)) <= 7);
  setConfig(CLAVE_RESUMEN, vigentes.join(","));
}

function aFila(c: Clase): FilaCalendario {
  return {
    id: c.id,
    fecha: c.fecha as string,
    hora: c.hora,
    profe: c.profe,
    alumnos: (c.alumnos ?? []).map((a) => String(a)),
    nota: c.nota,
    aviso_5h: c.aviso_5h ?? 0,
  };
}

/** Una pasada. Exportada para probarla de punta a punta sin esperar 5 min. */
export async function tickRecordatorios(): Promise<void> {
  if (!pushConfigurado()) return; // sin claves VAPID no hay a quién avisar
  const hoy = todaySantiago();
  const ahora = nowSantiago().slice(11); // "HH:MM"
  // Ventana: hoy y mañana. Nada más lejos entra ni en el resumen ni en las 5 h.
  const filas = listClasesRange(hoy, sumarDias(hoy, 1))
    .filter((c) => !!c.fecha)
    .map(aFila);

  const pendientes = recordatoriosPendientes(filas, hoy, ahora, resumenesEnviados());

  for (const r of pendientes) {
    // Se marca ANTES de enviar: si el push falla se pierde ese aviso, pero si se
    // marcara después un error a medias lo repetiría cada 5 minutos.
    if (r.clase === "resumen" && r.fechaResumen) anotarResumen(r.fechaResumen, hoy);
    else marcarAviso5h(r.filas);

    await enviarPush({ titulo: r.titulo, cuerpo: r.cuerpo, url: r.url, tag: r.tag });
    logger.info({ clase: r.clase, filas: r.filas }, "Recordatorio de calendario enviado");
  }
}

export function startRecordatoriosLoop(): void {
  if (timer || corriendo) return;
  const run = async () => {
    corriendo = true;
    try {
      await tickRecordatorios();
    } catch (err) {
      logger.error({ err }, "Recordatorios: error en el tick; reintenta");
    } finally {
      corriendo = false;
      timer = setTimeout(run, INTERVALO_MS);
    }
  };
  timer = setTimeout(run, 20_000); // arranca 20 s tras levantar el bot
  logger.info("Loop de recordatorios del calendario iniciado");
}

export function stopRecordatoriosLoop(): void {
  if (timer) { clearTimeout(timer); timer = null; }
}
