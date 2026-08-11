/**
 * Ensayo con ARRASTRE: los dos fallos que `ensayo:cerebro` no caza.
 *
 * El 10-08-2026, con el cerebro nuevo ya desplegado, el bot falló en producción dos veces
 * seguidas... y el arnés normal seguía en verde. La diferencia no era el prompt: era la
 * CONVERSACIÓN ENCIMA. `ensayo:cerebro` arranca de cero con un guion de 16 turnos; la
 * pantalla de práctica de Mary llevaba 66 mensajes, y con ese arrastre el modelo se queda
 * enganchado en lo último que ofreció ("¿te guardo el cupo?") y pisa las reglas.
 *
 * Por eso este arnés parte del historial REAL de esa práctica (`fixtures/practica-mary-10ago.json`,
 * saneado: el teléfono y el Instagram de la psicóloga son de una persona de verdad) y repite
 * los dos turnos exactos que fallaron:
 *
 *   A. "¿y me pasas los datos para transferir?" → respondió "primero necesito tu nombre y el
 *      de tu hija", justo lo que el prompt prohíbe. Los datos se dan al tiro y completos.
 *   B. "¿ustedes trabajan con psicólogos?" → lo contó pero NO llamó a derivarHumano(), así que
 *      la apoderada se quedó esperando un contacto que nadie le iba a mandar. Misma familia
 *      que el "le aviso a Mary" que no avisaba.
 *
 *   npx tsx scripts/ensayo-arrastre.ts
 */
import "./env-loader.js";
import fs from "node:fs";
import path from "node:path";
import { responderEnsayo, resumenUso, type TurnoEnsayo } from "../src/lib/ensayo.js";

const FIXTURE = path.resolve(process.cwd(), "scripts", "fixtures", "practica-mary-10ago.json");

let fallos = 0;
function mal(msg: string) { console.log(`   ❌ ${msg}`); fallos++; }
function bien(msg: string) { console.log(`   ✅ ${msg}`); }

function historial(hasta: number): TurnoEnsayo[] {
  const crudo = JSON.parse(fs.readFileSync(FIXTURE, "utf-8")) as {
    mensajes: { rol: "apoderado" | "bot"; texto: string }[];
  };
  return crudo.mensajes.slice(0, hasta).map((m) => ({ rol: m.rol, texto: m.texto }));
}

/** Un turno suelto sobre un historial dado, sin encadenar con los otros casos. */
async function turno(hasta: number, texto: string) {
  const turnos = historial(hasta);
  turnos.push({ rol: "apoderado", texto });
  const r = await responderEnsayo(turnos);
  console.log(`👩 mamá (con ${turnos.length - 1} mensajes encima): ${texto}`);
  console.log(`🎨 bot : ${r.texto || "(no respondería nada)"}`);
  r.acciones.forEach((a) => console.log(`         ↳ ${a}`));
  return r;
}

async function main() {
  console.log("\n🎭 Ensayo con arrastre — los dos turnos que fallaron en producción el 10-08\n");
  const arranque = Date.now();

  // ── A. Los datos para transferir, justo después de ofrecerle el cupo ──────────
  // El historial termina en la respuesta del bot con los horarios y un "¿te guardo el cupo?".
  const a = await turno(62, "Ya, ¿y me pasas los datos para transferir?");
  a.texto.includes("1098729145") ? bien("da el número de cuenta") : mal("no dio el número de cuenta");
  a.texto.includes("78.387.831-3") ? bien("da el RUT de la empresa") : mal("no dio el RUT");
  // Lo que hizo en producción: cambiar los datos por el nombre. Puede pedirlo DESPUÉS, en el
  // mismo mensaje, pero nunca a cambio de los datos.
  // Cualquier "primero/antes" es la misma trampa, cambie los datos por el nombre o por el
  // horario: las dos veces que se reprodujo, la excusa fue distinta y el resultado el mismo.
  /\b(primero|antes)\b/i.test(a.texto)
    ? mal("cambió los datos por otra cosa ('primero...')")
    : bien("no puso condiciones antes de dar los datos");
  console.log("");

  // ── B. La psicóloga: lo cuenta, pero tiene que avisarle a Mary ────────────────
  // En producción NO derivó; en la primera corrida de este arnés SÍ. Es intermitente, así que
  // se repite: un candado que solo mira una tirada da verde por suerte y no prueba nada.
  const VECES_B = 3;
  for (let i = 1; i <= VECES_B; i++) {
    const b = await turno(64, "Una consulta, ¿ustedes trabajan con psicólogos?");
    /psic[oó]log/i.test(b.texto) ? bien(`(${i}/${VECES_B}) cuenta que sí trabajan con una psicóloga`) : mal(`(${i}/${VECES_B}) esquivó lo de la psicóloga`);
    /9120\s?8051|instagram\.com/i.test(b.texto) && mal(`(${i}/${VECES_B}) entregó el contacto de la psicóloga (lo da Mary)`);
    b.acciones.some((x) => x.includes("pasado la conversación"))
      ? bien(`(${i}/${VECES_B}) le pasa la conversación a Mary para que entregue el contacto`)
      : mal(`(${i}/${VECES_B}) prometió el contacto y NO derivó: la apoderada queda esperando`);
    console.log("");
  }

  console.log(resumenUso(Date.now() - arranque));
  console.log(fallos === 0
    ? "🎉 Con la conversación encima, el bot sigue cumpliendo\n"
    : `⚠️  ${fallos} fallos con arrastre (el arnés normal no los ve)\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error("💥", e?.message ?? e); process.exit(2); });
