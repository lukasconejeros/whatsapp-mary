// Tool: fecha_de_dia_semana
// Devuelve la fecha ISO del próximo día de la semana dado (en hora Chile)

export const fechaDiaSemanaDefinition = {
  type: "function" as const,
  function: {
    name: "fecha_de_dia_semana",
    description:
      "Convierte un nombre de día ('lunes', 'martes', etc.) a su fecha ISO YYYY-MM-DD próxima, calculada en hora de Chile. Usar SIEMPRE antes de agendar o verificar disponibilidad cuando el paciente diga un día de la semana.",
    parameters: {
      type: "object" as const,
      properties: {
        dia: {
          type: "string",
          description:
            "Nombre del día en español (lunes, martes, miércoles, jueves, viernes, sábado, domingo). También acepta 'hoy' y 'mañana'.",
        },
      },
      required: ["dia"],
    },
  },
};

const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
};

function fechaChileHoy(): Date {
  // Devuelve la fecha actual en hora de Chile como Date UTC midnight
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function fechaDiaSemana(
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const dia = String(args.dia ?? "").toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

  const hoy = fechaChileHoy();

  if (dia === "hoy") {
    return { iso: hoy.toISOString().slice(0, 10), dia_semana: dia, ok: true };
  }
  if (dia === "manana" || dia === "mañana") {
    const m = new Date(hoy); m.setUTCDate(m.getUTCDate() + 1);
    return { iso: m.toISOString().slice(0, 10), dia_semana: "mañana", ok: true };
  }

  const targetDow = DIAS[dia];
  if (targetDow === undefined) {
    return { ok: false, error: `Día no reconocido: '${dia}'. Usa: lunes, martes, miércoles, jueves, viernes, sábado, domingo.` };
  }

  const todayDow = hoy.getUTCDay();
  let diff = targetDow - todayDow;
  if (diff <= 0) diff += 7; // siempre el próximo (no el de hoy)

  const next = new Date(hoy);
  next.setUTCDate(next.getUTCDate() + diff);
  return { iso: next.toISOString().slice(0, 10), dia_semana: dia, ok: true };
}
