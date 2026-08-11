// Prueba de humo del pase de lista contra la base REAL y con la fecha de HOY:
// crea una clase con dos alumnos de prueba, dispara el aviso de las 21:00, lee
// lo que quedó en la cola, contesta como contestaría Mary y comprueba que la
// asistencia quedó bien. Borra todo lo suyo al final.
//
// El teléfono es falso: nada de esto le llega a nadie.
import "./env-loader.js";
import {
  addClase, deleteClase, getPendingOutbox, markOutboxFailed, borrarAvisoDiario,
  getPaseLista, borrarPaseLista, asistenciaRango, borrarAsistencia,
  getOrCreateConversation, deleteConversation,
} from "../src/lib/db.js";
import { tickAvisosMary, procesarRespuestaPaseLista } from "../src/lib/avisos-mary-loop.js";
import { todaySantiago } from "../src/lib/fechas.js";
import { diaFromFecha } from "../src/lib/calendario.js";

const TELEFONO = "56900000003";
const HOY = todaySantiago();
let claseId: number | null = null;
let malas = 0;
const paso = (n: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${n}${extra ? ` — ${extra}` : ""}`);
  if (!ok) malas++;
};

try {
  console.log(`\n🔥 Humo del pase de lista · hoy es ${HOY}\n`);
  claseId = addClase({ fecha: HOY, dia: diaFromFecha(HOY), profe: "Mary", hora: "17:00", alumnos: ["Zoe HUMO", "Lucas HUMO"] });

  const r = tickAvisosMary({ hoy: HOY, ahora: "21:00", phone: TELEFONO });
  paso("a las 21:00 encola el pase de lista", r.encolados === 1, JSON.stringify(r));

  const pregunta = getPendingOutbox(300).filter((o) => o.phone === TELEFONO).pop()?.content ?? "";
  console.log(`\n   📤 le llega: ${pregunta.replace(/\n/g, "\n              ")}\n`);
  paso("la pregunta nombra a los dos alumnos", ["Zoe HUMO", "Lucas HUMO"].every((n) => pregunta.includes(n)));
  paso("y queda abierto el pase de lista", getPaseLista(HOY)?.respondidoAt === null);

  const atendido = procesarRespuestaPaseLista("no vino Zoe", { hoy: HOY, ahora: "21:20", phone: TELEFONO });
  paso("contesta «no vino Zoe» y lo atiende el pase de lista", atendido === true);

  const respuesta = getPendingOutbox(300).filter((o) => o.phone === TELEFONO).pop()?.content ?? "";
  console.log(`\n   📤 le responde: ${respuesta}\n`);
  const marcado = asistenciaRango(HOY, HOY).filter((a) => a.alumno.includes("HUMO"));
  paso("Zoe queda como que faltó", marcado.find((a) => a.alumno === "Zoe HUMO")?.estado === "falto", JSON.stringify(marcado));
  paso("Lucas queda como que vino", marcado.find((a) => a.alumno === "Lucas HUMO")?.estado === "vino");
  paso("y el pase de lista se cierra", getPaseLista(HOY)?.respondidoAt !== null);
  paso("un mensaje suyo posterior ya no lo toma",
    procesarRespuestaPaseLista("acuérdate de comprar arcilla", { hoy: HOY, ahora: "21:40", phone: TELEFONO }) === false);
} finally {
  for (const o of getPendingOutbox(400)) if (o.phone === TELEFONO) markOutboxFailed(o.id);
  if (claseId) deleteClase(claseId);
  for (const a of asistenciaRango(HOY, HOY)) if (a.alumno.includes("HUMO")) borrarAsistencia(HOY, a.alumno);
  borrarPaseLista(HOY);
  borrarAvisoDiario(HOY, "pase-lista");
  borrarAvisoDiario(HOY, "resumen");
  deleteConversation(getOrCreateConversation(TELEFONO, "HUMO").id);
  paso("limpieza: nada vivo en la cola", getPendingOutbox(400).every((o) => o.phone !== TELEFONO));
  paso("limpieza: sin asistencia de humo", asistenciaRango(HOY, HOY).every((a) => !a.alumno.includes("HUMO")));
  paso("limpieza: sin pase de lista de hoy", getPaseLista(HOY) === null);
}

console.log(malas === 0 ? "\n🎉 el flujo completo funciona\n" : `\n💥 ${malas} pasos mal\n`);
process.exit(malas === 0 ? 0 : 1);
