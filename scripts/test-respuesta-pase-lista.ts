// Lo que pasa cuando Mary contesta el pase de lista en su chat consigo misma:
// que se marque la asistencia, que le conteste, que pida aclaración UNA vez y
// que un mensaje cualquiera suyo siga su camino de siempre.
import "./env-loader.js";
import {
  abrirPaseLista, getPaseLista, borrarPaseLista, asistenciaRango, borrarAsistencia,
  getPendingOutbox, markOutboxFailed, getOrCreateConversation, deleteConversation,
} from "../src/lib/db.js";
import { procesarRespuestaPaseLista } from "../src/lib/avisos-mary-loop.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const TELEFONO = "56900000002"; // falso
const HOY = "2099-02-10";
const AYER = "2099-02-09";
const A = ["Mateo", "Matilda", "Sofía"];
const opts = (extra: Record<string, unknown> = {}) => ({ hoy: HOY, ahora: "21:30", phone: TELEFONO, ...extra });
const ultimoMensaje = () => getPendingOutbox(200).filter((o) => o.phone === TELEFONO).pop()?.content ?? "";

try {
  console.log("Sin pase de lista abierto");
  check("un mensaje cualquiera sigue su camino", procesarRespuestaPaseLista("hola, anota que falta arcilla", opts()) === false);

  console.log("\nContesta que faltó uno");
  abrirPaseLista(HOY, A);
  check("lo atiende el pase de lista", procesarRespuestaPaseLista("no fue Mateo", opts()) === true);
  const marcado = asistenciaRango(HOY, HOY);
  check("Mateo queda como que faltó", marcado.find((a) => a.alumno === "Mateo")?.estado === "falto", JSON.stringify(marcado));
  check("los otros dos, como que vinieron", marcado.filter((a) => a.estado === "vino").length === 2, JSON.stringify(marcado));
  check("queda anotado que vino por WhatsApp", marcado.every((a) => a.fuente === "whatsapp"));
  check("le contesta nombrando a Mateo", ultimoMensaje().includes("Mateo"), ultimoMensaje());
  check("y cierra el pase de lista", getPaseLista(HOY)?.respondidoAt !== null);
  check("un segundo mensaje ya no lo toma", procesarRespuestaPaseLista("ah, y tampoco fue Sofía", opts()) === false);

  console.log("\nCuando no entiende");
  for (const a of asistenciaRango(HOY, HOY)) borrarAsistencia(HOY, a.alumno);
  borrarPaseLista(HOY);
  abrirPaseLista(HOY, A);
  check("lo atiende igual", procesarRespuestaPaseLista("mmm no me acuerdo bien", opts()) === true);
  check("no marca a nadie", asistenciaRango(HOY, HOY).length === 0);
  check("le pide los nombres", ultimoMensaje().toLowerCase().includes("nombres"), ultimoMensaje());
  check("y deja el pase abierto para que conteste", getPaseLista(HOY)?.respondidoAt === null);
  check("suma la aclaración", getPaseLista(HOY)?.aclaraciones === 1);

  check("a la segunda no insiste más", procesarRespuestaPaseLista("es que no sé", opts()) === true);
  check("le dice que lo deje así", ultimoMensaje().toLowerCase().includes("calendario"), ultimoMensaje());
  check("el día queda sin marcar", asistenciaRango(HOY, HOY).length === 0);
  check("y ya no vuelve a tomar sus mensajes", procesarRespuestaPaseLista("otra cosa", opts()) === false);

  console.log("\nLa segunda vez sí acierta");
  borrarPaseLista(HOY);
  abrirPaseLista(HOY, A);
  procesarRespuestaPaseLista("quién?", opts());
  check("tras la aclaración, entiende la respuesta buena", procesarRespuestaPaseLista("faltó Sofía", opts()) === true);
  check("y marca a Sofía", asistenciaRango(HOY, HOY).find((a) => a.alumno === "Sofía")?.estado === "falto");

  console.log("\nLa respuesta que llega al otro día");
  for (const a of asistenciaRango(HOY, HOY)) borrarAsistencia(HOY, a.alumno);
  borrarPaseLista(HOY);
  abrirPaseLista(AYER, A);
  check("a las 09:00 del día siguiente todavía vale",
    procesarRespuestaPaseLista("no fue Matilda", { hoy: HOY, ahora: "09:00", phone: TELEFONO }) === true);
  check("y se marca en el día que era, no en hoy", asistenciaRango(AYER, AYER).find((a) => a.alumno === "Matilda")?.estado === "falto");

  for (const a of asistenciaRango(AYER, AYER)) borrarAsistencia(AYER, a.alumno);
  borrarPaseLista(AYER);
  abrirPaseLista(AYER, A);
  check("pasado mediodía ya no lo toma",
    procesarRespuestaPaseLista("no fue Matilda", { hoy: HOY, ahora: "12:30", phone: TELEFONO }) === false);
  check("y no marca nada", asistenciaRango(AYER, AYER).length === 0);
} finally {
  for (const o of getPendingOutbox(300)) if (o.phone === TELEFONO) markOutboxFailed(o.id);
  for (const f of [HOY, AYER]) {
    for (const a of asistenciaRango(f, f)) borrarAsistencia(f, a.alumno);
    borrarPaseLista(f);
  }
  const conv = getOrCreateConversation(TELEFONO, "PRUEBA");
  deleteConversation(conv.id);
  check("limpieza: sin asistencia de prueba", asistenciaRango(AYER, HOY).length === 0);
  check("limpieza: nada vivo en la cola", getPendingOutbox(300).every((o) => o.phone !== TELEFONO));
}

console.log(`\n${pass} bien, ${fail} mal`);
process.exit(fail === 0 ? 0 : 1);
