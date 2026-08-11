// Manda los dos avisos fijos de Mary por WhatsApp A SU PROPIO NÚMERO —el mismo
// del bot, el chat consigo misma—: el resumen de las 10:00 y el pase de lista de
// las 21:00 (Lukas, 11-08-2026).
//
// Se apoya en el outbox de siempre (encola y él despacha con su ritmo), así que
// aquí no se toca Baileys.
//
// EL CANDADO QUE IMPORTA: 'enviado_at' NO se escribe al encolar. Se encola, se
// guarda el número de la cola y solo cuando el outbox confirma que WhatsApp lo
// mandó se marca como enviado. El "enviado" falso ya costó un incidente. Si el
// envío fracasa, la fila se suelta y la próxima pasada lo reintenta (mientras
// siga dentro de la ventana de gracia).
import pino from "pino";
import {
  getAvisoDiario, marcarAvisoEncolado, marcarAvisoEnviado,
  abrirPaseLista, getOutboxSent, enqueueOutbox, getOrCreateConversation,
  type TipoAviso,
} from "./db.js";
import { armarDia } from "./dia-de-mary.js";
import { tocaAviso, textoResumen, textoPaseLista } from "./avisos-mary.js";
import { telefonoDelBot } from "./recordatorios-wa-loop.js";
import { todaySantiago, nowSantiago } from "./fechas.js";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

const TIPOS: TipoAviso[] = ["resumen", "pase-lista"];

/** El chat de Mary consigo misma. Mismo nombre que usan sus recordatorios. */
export const NOMBRE_CHAT = "Mis recordatorios";

export interface ResultadoAvisos {
  /** Avisos que se pusieron en la cola de WhatsApp en esta pasada. */
  encolados: number;
  /** Los que WhatsApp ya despachó y quedaron marcados como enviados. */
  confirmados: number;
}

function ayerDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Una pasada. Exportada para probarla de punta a punta sin esperar los 5 min.
 *
 * @param opts.phone teléfono al que se manda. Por defecto, el del propio bot.
 *                   `null` = WhatsApp caído: no se encola nada.
 */
export function tickAvisosMary(opts: {
  hoy?: string;
  ahora?: string;
  phone?: string | null;
} = {}): ResultadoAvisos {
  const hoy = opts.hoy ?? todaySantiago();
  const ahora = opts.ahora ?? nowSantiago().slice(11); // "HH:MM"
  const phone = "phone" in opts ? opts.phone ?? null : telefonoDelBot();

  // ── 1. Los que iban en camino: ¿salieron? ────────────────────────────────
  // Se mira también ayer para no dejar colgado lo de un cambio de día.
  let confirmados = 0;
  for (const fecha of [ayerDe(hoy), hoy]) {
    for (const tipo of TIPOS) {
      const a = getAvisoDiario(fecha, tipo);
      if (!a || a.outboxId === null || a.enviadoAt !== null) continue;
      const estado = getOutboxSent(a.outboxId);
      if (estado === 1) {
        marcarAvisoEnviado(fecha, tipo);
        confirmados++;
        logger.info({ fecha, tipo }, "Aviso de Mary entregado por WhatsApp");
      } else if (estado === 2 || estado === null) {
        // Descartado por el outbox (o la fila ya no está): se suelta para reintentar.
        marcarAvisoEncolado(fecha, tipo, null);
        logger.warn({ fecha, tipo }, "El envío del aviso falló; se reintenta");
      }
    }
  }

  // ── 2. Los que toca mandar ahora ─────────────────────────────────────────
  if (!phone) return { encolados: 0, confirmados };

  const pendientes = TIPOS.filter((tipo) => {
    if (!tocaAviso(tipo, ahora)) return false;
    const a = getAvisoDiario(hoy, tipo);
    // Ya salió, o está esperando en la cola: no se toca.
    return !a || (a.enviadoAt === null && a.outboxId === null);
  });
  if (pendientes.length === 0) return { encolados: 0, confirmados };

  const dia = armarDia(hoy);
  let encolados = 0;
  for (const tipo of pendientes) {
    // Un día sin nada agendado no se molesta a nadie: ni resumen, ni pase de
    // lista si ese día no había alumnos (decisión de Lukas, 11-08-2026).
    if (tipo === "resumen" && dia.items.length === 0) continue;
    if (tipo === "pase-lista" && dia.alumnos.length === 0) continue;

    const texto = tipo === "resumen"
      ? textoResumen(hoy, dia.items)
      : textoPaseLista(dia.alumnos);

    const conv = getOrCreateConversation(phone, NOMBRE_CHAT);
    const outboxId = enqueueOutbox(conv.id, phone, texto, { kind: "text" });
    marcarAvisoEncolado(hoy, tipo, outboxId);
    // La lista de nombres se guarda con la pregunta: contra ELLA se interpreta
    // después la respuesta, aunque para entonces la clase haya cambiado.
    if (tipo === "pase-lista") abrirPaseLista(hoy, dia.alumnos);
    encolados++;
    logger.info({ fecha: hoy, tipo, outboxId }, "Aviso de Mary encolado a WhatsApp");
  }

  return { encolados, confirmados };
}
