// Planificador de la CAMPAÑA de seguimiento (proceso del bot). Drena la cola
// `seguimientos` de a UNO, con pausas largas aleatorias, tope diario y ventana
// horaria (anti-baneo). NO toca el outbox por dentro: encola por su API pública.
import pino from "pino";
import {
  getSeguimientoPendiente,
  countSeguimientosEnviadosDia,
  markSeguimientoEnviado,
  markSeguimientoOmitido,
  getConversationById,
  getClienteByPhone,
  enqueueOutbox,
  insertMessage,
  getConnectionState,
} from "./db.js";
import { todaySantiago, hourSantiago } from "./fechas.js";
import { CAMPANA, redactarSeguimiento } from "./seguimiento.js";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

let timer: ReturnType<typeof setTimeout> | null = null;
let corriendo = false;

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// Una pasada. Devuelve los ms hasta la próxima. Cuando no hay nada que hacer (sin
// pendientes / fuera de horario / al tope / desconectado) espera y reintenta; solo
// tras ENVIAR uno aplica la pausa larga aleatoria.
async function tick(): Promise<number> {
  const pend = getSeguimientoPendiente();
  if (!pend) return 60_000; // nada pendiente: revisa en 1 min por si Mary encola

  if (getConnectionState().status !== "connected") return 30_000; // WhatsApp caído: espera

  const h = hourSantiago();
  if (h < CAMPANA.horaInicio || h >= CAMPANA.horaFin) return 10 * 60_000; // fuera de horario

  const hoy = todaySantiago();
  if (countSeguimientosEnviadosDia(hoy) >= CAMPANA.capDiario) return 15 * 60_000; // tope diario

  const conv = getConversationById(pend.conversation_id);
  if (!conv) { markSeguimientoOmitido(pend.id); return 2_000; } // conversación borrada: saltar

  const cli = getClienteByPhone(conv.phone);
  const mensaje = await redactarSeguimiento(conv.name, cli?.alumnos ?? null);
  // Reclamo ATÓMICO: si dejó de estar pendiente mientras redactaba la IA (Mary tocó
  // "Detener"), no se envía. Sólo tras reclamar se encola y se muestra en el chat.
  if (!markSeguimientoEnviado(pend.id, mensaje, hoy)) return 2_000;
  enqueueOutbox(conv.id, conv.phone, mensaje, { kind: "text" });
  insertMessage(conv.id, "human", mensaje); // se ve en el chat como enviado por Mary
  logger.info({ conv: conv.id }, "Seguimiento: mensaje encolado");

  return randInt(CAMPANA.pausaMinS, CAMPANA.pausaMaxS) * 1000; // pausa larga anti-baneo
}

export function startSeguimientoLoop(): void {
  if (timer || corriendo) return;
  const run = async () => {
    corriendo = true;
    let next = 60_000;
    try {
      next = await tick();
    } catch (err) {
      logger.error({ err }, "Seguimiento: error en el tick; reintenta");
      next = 60_000;
    } finally {
      corriendo = false;
      timer = setTimeout(run, next);
    }
  };
  timer = setTimeout(run, 15_000); // arranca 15 s tras levantar el bot
  logger.info("Loop de seguimiento iniciado");
}

export function stopSeguimientoLoop(): void {
  if (timer) { clearTimeout(timer); timer = null; }
}
