// Tool: validar_fecha_dentro_horarios_clinica
// Valida si una fecha+hora está dentro del horario de la clínica y del doctor (si se especifica)

export const validarFechaDefinition = {
  type: "function" as const,
  function: {
    name: "validar_fecha_dentro_horarios_clinica",
    description:
      "Valida si una fecha ISO y hora HH:MM están dentro del horario de atención de la clínica y, opcionalmente, del doctor indicado. Llamar ANTES de confirmar cualquier slot al paciente.",
    parameters: {
      type: "object" as const,
      properties: {
        fecha_iso: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
        hora_hhmm: { type: "string", description: "Hora en formato HH:MM (24h)" },
        id_dentista: { type: "number", description: "ID numérico del dentista (opcional). Si se pasa, valida también su horario específico." },
      },
      required: ["fecha_iso", "hora_hhmm"],
    },
  },
};

// Horarios doctor → [[inicio_min, fin_min], ...] por día (0=dom..6=sab)
const HORARIOS_DOCTOR: Record<number, Partial<Record<number, [number, number][]>>> = {
  5:   { 1: [[540, 1020]], 6: [[540, 750]] },                          // Pinto: lun, sáb c/2sem
  88:  { 2: [[540, 1050]], 5: [[540, 750]] },                          // Serrano: mar, vie
  98:  { 5: [[840, 1050]], 6: [[540, 750]] },                          // Celis: vie, sáb c/2sem
  105: { 2: [[840, 1050]], 3: [[540, 1050]], 4: [[540, 1050]], 6: [[540, 750]] }, // Leiva: mar-jue, sáb
  107: { 4: [[540, 930]], 5: [[840, 930]] },                           // Lavarello: jue, vie tarde
};

// Horario clínica por día
const CLINICA: Partial<Record<number, [number, number][]>> = {
  1: [[540, 780], [840, 1080]], // lun
  2: [[540, 780], [840, 1080]], // mar
  3: [[540, 780], [840, 1080]], // mié
  4: [[540, 780], [840, 1080]], // jue
  5: [[540, 780], [840, 1080]], // vie
  6: [[540, 840]],              // sáb
  // 0: cerrado (domingo)
};

function inRange(minutos: number, rangos: [number, number][]): boolean {
  return rangos.some(([s, e]) => minutos >= s && minutos < e);
}

export async function validarFecha(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fechaIso = String(args.fecha_iso ?? "");
  const horaHhmm = String(args.hora_hhmm ?? "");
  const idDentista = args.id_dentista ? Number(args.id_dentista) : null;

  const [hh, mm] = horaHhmm.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) {
    return { valido: false, razon: "Hora inválida. Usar formato HH:MM." };
  }
  const minutos = hh * 60 + mm;

  const [y, mo, d] = fechaIso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=dom

  const rangosClinica = CLINICA[dow];
  if (!rangosClinica) {
    return { valido: false, razon: "La clínica no atiende ese día (domingo o festivo)." };
  }
  if (!inRange(minutos, rangosClinica)) {
    const texto = dow === 6
      ? "El sábado atendemos de 9:00 a 14:00."
      : "De lunes a viernes atendemos de 9:00-13:00 y 14:00-18:00.";
    return { valido: false, razon: `Hora fuera del horario de clínica. ${texto}` };
  }

  if (idDentista) {
    const horarioDoc = HORARIOS_DOCTOR[idDentista]?.[dow];
    if (!horarioDoc) {
      return {
        valido: false,
        razon: `El doctor (id ${idDentista}) no atiende ese día de la semana.`,
      };
    }
    if (!inRange(minutos, horarioDoc)) {
      return {
        valido: false,
        razon: `Hora fuera del horario del doctor (id ${idDentista}) ese día.`,
      };
    }
  }

  return { valido: true, fecha_iso: fechaIso, hora_hhmm: horaHhmm };
}
