import type { Message } from "./db.js";

export type EstadoTurno =
  | "LIBRE"
  | "ACUSE_RECIBO"
  | "CONFIRMAR_48H_ACK"
  | "CONFIRMAR_24H"
  | "CANCELAR_EJECUTAR"
  | "REAGENDAR_CONFIRMAR_SLOT"
  | "ESCALAR_RUT_LOOP"
  | "DESPEDIDA";

export interface TurnoState {
  estado: EstadoTurno;
  estadoMeta: Record<string, unknown>;
  intentosRutFallidos: number;
}

// Strip accents and lowercase for matching
function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

export function computeState(
  currentMsg: string,
  history: Message[]
): TurnoState {
  const msg = norm(currentMsg);

  // Bot messages (assistant), most recent last
  const botMsgs = history
    .filter((m) => m.role === "assistant")
    .map((m) => m.content);
  const lastBot = botMsgs[botMsgs.length - 1] ?? "";
  const lastBotNorm = norm(lastBot);

  // ── Detectores de intención del paciente ────────────────────────
  const isAffirmation =
    /^(si|sii|siii|s |ok|dale|listo|perfecto|confirmo|confirmar|confirmado|confirmamos|confirma|correcto|exacto|esa|ese|eso|afirmo|asisto|asistire|asistira|asistiremos|asistiran|voy|ire|iremos|claro|bueno|ya|ahi|genial|de acuerdo|con gusto|por supuesto|excelente|bien|cuenten|contamos|ahi estaremos|ahi estare|estaremos|estare)/.test(
      msg
    ) ||
    /^(si quiero|si por favor|si gracias|si esa|si ese|si confirmo|si confirmamos|si asistire|si ire|si voy|si vamos|vamos a asistir|alli estaremos|alla estaremos)/.test(
      msg
    ) ||
    msg === "si" ||
    msg === "s" ||
    /^👍|^✅/.test(currentMsg.trim());

  const isCancelIntent =
    /\b(cancel|anul|anulo|anular|cancelar|no (voy|asistire|asisto|puedo|podre|ire)|no pued|tuve un problema|tuve una emergencia|surgio algo|no podre|no podr[eé]|no ire|no ir[eé]|no asistire|ya no puedo)\b/.test(
      msg
    );

  const isRescheduleIntent =
    /\b(reagend|cambiar|cambio|mover|otro dia|otra hora|otro horario|reprogramar|postergar|no me sirve ese dia|no puedo ese dia)\b/.test(
      msg
    );

  // ── Detectores del contexto del bot ────────────────────────────
  const botAskingCancelConfirm =
    /confirma que quiere cancelarla|confirma que quiere anularla|confirma la cancelacion|desea cancelarla|quiere que la cancel/.test(
      lastBotNorm
    );

  const botJustConfirmedAttendance =
    /queda confirmada|queda confirmado|le esperamos en clinica anpalex|cita del.*queda confirmada/.test(
      lastBotNorm
    );

  const botOfferedSlot =
    /tengo disponible|hay disponibilidad|esta disponible el|podria ser el.*a las|le acomoda el/.test(
      lastBotNorm
    );

  const botAsking48h =
    /manana te escribo para confirmar|manana le escribo para confirmar/.test(
      lastBotNorm
    );

  const botAsking24h =
    /para confirmar respondeme|para confirmar respondame|te escribo para confirmar tu cita|le escribo para confirmar su cita/.test(
      lastBotNorm
    );

  // ── Extraer id_cita del último mensaje del bot ──────────────────
  let idCitaFromBot: number | null = null;
  const idMatch =
    lastBot.match(/id[_-]?cita[_-]?dentalink[:\s=]+(\d+)/i) ??
    lastBot.match(/cita[_-]?(?:id|#)[:\s]*(\d+)/i) ??
    lastBot.match(/id[:\s]*(\d{5,8})/i);
  if (idMatch) idCitaFromBot = parseInt(idMatch[1], 10);

  // ── Contar intentos fallidos de RUT ────────────────────────────
  const recentBot = botMsgs.slice(-6);
  const intentosRutFallidos = recentBot.filter((t) =>
    /no encontre.*cita|no encontro.*cita|no encontre.*rut|no encuentro.*rut|no encontre ningun|no encontre ninguna|podria verificar el rut|verifique el rut|verificar su rut/i.test(
      t
    )
  ).length;

  // ── Determinar estado ───────────────────────────────────────────
  if (botAskingCancelConfirm && isAffirmation) {
    return {
      estado: "CANCELAR_EJECUTAR",
      estadoMeta: { id_cita: idCitaFromBot },
      intentosRutFallidos,
    };
  }

  if (
    botJustConfirmedAttendance &&
    currentMsg.length < 40 &&
    !isCancelIntent &&
    !isRescheduleIntent
  ) {
    return { estado: "ACUSE_RECIBO", estadoMeta: {}, intentosRutFallidos };
  }

  if (botAsking48h && isAffirmation) {
    return {
      estado: "CONFIRMAR_48H_ACK",
      estadoMeta: {},
      intentosRutFallidos,
    };
  }

  if (
    botAsking24h &&
    (isAffirmation ||
      /\b(confirm|asistir|ire|voy|vamos|estar|cuenten|contamos)\b/.test(msg))
  ) {
    return { estado: "CONFIRMAR_24H", estadoMeta: {}, intentosRutFallidos };
  }

  if (botOfferedSlot && isAffirmation && !isCancelIntent) {
    return {
      estado: "REAGENDAR_CONFIRMAR_SLOT",
      estadoMeta: {},
      intentosRutFallidos,
    };
  }

  if (intentosRutFallidos >= 2) {
    return {
      estado: "ESCALAR_RUT_LOOP",
      estadoMeta: {
        razon: "rut_no_encontrado_repetido",
        intentos: intentosRutFallidos,
      },
      intentosRutFallidos,
    };
  }

  if (
    /\b(adios|chao|hasta luego|no gracias|no me interesa|no importa|dejalo|ya no|bye|no necesito|no quiero)\b/.test(
      msg
    ) &&
    msg.length < 50
  ) {
    return { estado: "DESPEDIDA", estadoMeta: {}, intentosRutFallidos };
  }

  return { estado: "LIBRE", estadoMeta: {}, intentosRutFallidos };
}
