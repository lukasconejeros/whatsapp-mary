// Envío de los RECORDATORIOS que Mary crea en el formulario del calendario.
// Van por WhatsApp A SU PROPIO NÚMERO —el mismo del bot: el chat consigo misma—,
// nunca a un apoderado (decisión de Lukas, 10-08-2026).
//
// Se apoya en el outbox de siempre (encola y él despacha con su ritmo), así que
// aquí no se toca Baileys ni se manda nada directo.
//
// EL CANDADO QUE IMPORTA: 'enviado_at' NO se escribe al encolar. Se encola, se
// guarda el número de la cola en la fila y solo cuando el outbox confirma que
// WhatsApp lo mandó se marca como enviado. El "enviado" falso ya costó un
// incidente en la app de Lukas. Si el envío fracasa, la fila se suelta y la
// próxima pasada lo reintenta (mientras siga dentro de la ventana de gracia).
import pino from "pino";
import {
  listRecordatorios, recordatoriosDeFecha, marcarRecordatorioEnviado,
  marcarRecordatorioEncolado, getOutboxSent, enqueueOutbox,
  getOrCreateConversation, getConnectionState, type Recordatorio,
} from "./db.js";
import { recordatoriosPorMandar, type FilaRecordatorio } from "./recordatorios-wa.js";
import { todaySantiago, nowSantiago } from "./fechas.js";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

export interface ResultadoTickWa {
  /** Recordatorios que se pusieron en la cola de WhatsApp en esta pasada. */
  encolados: number;
  /** Los que WhatsApp ya despachó y quedaron marcados como enviados. */
  confirmados: number;
}

/** El número con el que está conectado el bot; null si WhatsApp no está en línea. */
export function telefonoDelBot(): string | null {
  const st = getConnectionState();
  if (st?.status !== "connected") return null;
  return st.phone || null;
}

function aFila(r: Recordatorio): FilaRecordatorio {
  return {
    id: r.id, fecha: r.fecha, hora: r.hora, texto: r.texto,
    avisar: r.avisar, enviadoAt: r.enviadoAt, hecho: r.hecho, outboxId: r.outboxId,
  };
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
export function tickRecordatoriosWa(opts: {
  hoy?: string;
  ahora?: string;
  phone?: string | null;
} = {}): ResultadoTickWa {
  const hoy = opts.hoy ?? todaySantiago();
  const ahora = opts.ahora ?? nowSantiago().slice(11); // "HH:MM"
  const phone = "phone" in opts ? opts.phone ?? null : telefonoDelBot();

  // ── 1. Los que iban en camino: ¿salieron? ────────────────────────────────
  // Se mira también el día de ayer para no dejar colgado lo de un cambio de día.
  let confirmados = 0;
  for (const r of listRecordatorios(ayerDe(hoy), hoy)) {
    if (r.outboxId === null || r.enviadoAt !== null) continue;
    const estado = getOutboxSent(r.outboxId);
    if (estado === 1) {
      marcarRecordatorioEnviado(r.id);
      confirmados++;
      logger.info({ recordatorio: r.id }, "Recordatorio de Mary entregado por WhatsApp");
    } else if (estado === 2 || estado === null) {
      // Descartado por el outbox (o la fila ya no está): se suelta para reintentar.
      marcarRecordatorioEncolado(r.id, null);
      logger.warn({ recordatorio: r.id }, "El envío del recordatorio falló; se reintenta");
    }
  }

  // ── 2. Los que toca mandar ahora ─────────────────────────────────────────
  if (!phone) return { encolados: 0, confirmados };

  const porMandar = recordatoriosPorMandar(recordatoriosDeFecha(hoy).map(aFila), hoy, ahora);
  if (porMandar.length === 0) return { encolados: 0, confirmados };

  // El chat de Mary consigo misma. Se crea una sola vez y se reutiliza.
  const conv = getOrCreateConversation(phone, "Mis recordatorios");
  let encolados = 0;
  for (const aviso of porMandar) {
    const outboxId = enqueueOutbox(conv.id, phone, aviso.mensaje, { kind: "text" });
    marcarRecordatorioEncolado(aviso.id, outboxId);
    encolados++;
    logger.info({ recordatorio: aviso.id, outboxId }, "Recordatorio de Mary encolado a WhatsApp");
  }

  return { encolados, confirmados };
}
