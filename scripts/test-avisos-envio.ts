// Los dos avisos nuevos contra la base y la cola de verdad: que se encolen a su
// hora, que NO se den por enviados hasta que WhatsApp confirme, que no se
// repitan y que un día vacío no moleste a Mary.
//
// El teléfono es falso a propósito y todo lo que se encola se descarta al final:
// si quedara vivo, el bot se lo mandaría de verdad al conectarse.
import "./env-loader.js";
import {
  addClase, deleteClase, getAvisoDiario, borrarAvisoDiario,
  getPaseLista, borrarPaseLista, getPendingOutbox, markOutboxSent, markOutboxFailed,
  getOrCreateConversation, deleteConversation,
} from "../src/lib/db.js";
import { tickAvisosMary } from "../src/lib/avisos-mary-loop.js";
import { diaFromFecha } from "../src/lib/calendario.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

const TELEFONO = "56900000001"; // falso
const F = "2099-01-05";         // el día con clase
const VACIO = "2099-01-09";     // un día sin nada
const SOLO_NOTA = "2099-01-10"; // un día con una anotación pero sin alumnos
const clases: number[] = [];

try {
  clases.push(addClase({ fecha: F, dia: diaFromFecha(F), profe: "Mary", hora: "16:00", alumnos: ["Mateo PRUEBA", "Sofia PRUEBA"] }));
  clases.push(addClase({ fecha: SOLO_NOTA, dia: diaFromFecha(SOLO_NOTA), profe: "Mary", nota: "PRUEBA arreglar el torno" }));

  console.log("WhatsApp caído");
  check("desconectado no encola nada", tickAvisosMary({ hoy: F, ahora: "10:00", phone: null }).encolados === 0);
  check("y no deja rastro del aviso", getAvisoDiario(F, "resumen") === null);

  console.log("\nEl resumen de las 10:00");
  check("antes de las 10 no sale", tickAvisosMary({ hoy: F, ahora: "09:30", phone: TELEFONO }).encolados === 0);
  const r1 = tickAvisosMary({ hoy: F, ahora: "10:00", phone: TELEFONO });
  check("a las 10 se encola", r1.encolados === 1, JSON.stringify(r1));
  const cola1 = getAvisoDiario(F, "resumen")?.outboxId ?? null;
  check("guarda el número de la cola", typeof cola1 === "number", String(cola1));
  check("todavía NO figura como enviado", getAvisoDiario(F, "resumen")?.enviadoAt === null);
  const enCola = getPendingOutbox(100).find((o) => o.id === cola1);
  check("el texto lleva la clase del día", enCola?.content.includes("Mateo PRUEBA") === true, enCola?.content);
  check("segunda pasada no lo repite", tickAvisosMary({ hoy: F, ahora: "10:05", phone: TELEFONO }).encolados === 0);

  markOutboxSent(cola1 as number);
  const r2 = tickAvisosMary({ hoy: F, ahora: "10:10", phone: TELEFONO });
  check("cuando WhatsApp lo manda, se confirma", r2.confirmados === 1, JSON.stringify(r2));
  check("ahora sí figura enviado", typeof getAvisoDiario(F, "resumen")?.enviadoAt === "number");
  check("y no se manda otra vez", tickAvisosMary({ hoy: F, ahora: "10:15", phone: TELEFONO }).encolados === 0);

  console.log("\nEl pase de lista de las 21:00");
  const r3 = tickAvisosMary({ hoy: F, ahora: "21:00", phone: TELEFONO });
  check("se encola", r3.encolados === 1, JSON.stringify(r3));
  const cola3 = getAvisoDiario(F, "pase-lista")?.outboxId ?? null;
  const enCola3 = getPendingOutbox(100).find((o) => o.id === cola3);
  check("pregunta por los dos alumnos", ["Mateo PRUEBA", "Sofia PRUEBA"].every((n) => enCola3?.content.includes(n) === true), enCola3?.content);
  const pl = getPaseLista(F);
  check("deja abierto el pase de lista", pl !== null && pl.respondidoAt === null, JSON.stringify(pl));
  // Ojo: ese día de la semana puede tener clases FIJAS de verdad, así que la
  // lista trae también a esos alumnos. Lo que se comprueba es que estén los de
  // la prueba y que sea exactamente la misma lista que se le preguntó.
  check("con la lista cerrada de nombres", ["Mateo PRUEBA", "Sofia PRUEBA"].every((n) => pl?.alumnos.includes(n) === true), JSON.stringify(pl?.alumnos));
  check("y esa lista es la que dice el mensaje", pl?.alumnos.every((n) => enCola3?.content.includes(n) === true) === true, enCola3?.content);

  console.log("\nSi el envío fracasa");
  markOutboxFailed(cola3 as number);
  const r4 = tickAvisosMary({ hoy: F, ahora: "21:10", phone: TELEFONO });
  check("no lo da por enviado", getAvisoDiario(F, "pase-lista")?.enviadoAt === null);
  check("lo suelta y lo vuelve a encolar", r4.encolados === 1 && getAvisoDiario(F, "pase-lista")?.outboxId !== cola3, JSON.stringify(r4));

  console.log("\nDías en los que se calla");
  check("día sin nada: ni resumen", tickAvisosMary({ hoy: VACIO, ahora: "10:00", phone: TELEFONO }).encolados === 0);
  check("día sin nada: ni pase de lista", tickAvisosMary({ hoy: VACIO, ahora: "21:00", phone: TELEFONO }).encolados === 0);
  check("solo una anotación: el resumen sí sale", tickAvisosMary({ hoy: SOLO_NOTA, ahora: "10:00", phone: TELEFONO }).encolados === 1);
  check("pero sin alumnos NO pasa lista", tickAvisosMary({ hoy: SOLO_NOTA, ahora: "21:00", phone: TELEFONO }).encolados === 0);
  check("y no abre un pase de lista vacío", getPaseLista(SOLO_NOTA) === null);
} finally {
  // Limpieza: la cola primero (que no salga nada de verdad), después los datos.
  for (const o of getPendingOutbox(200)) {
    if (o.phone === TELEFONO) markOutboxFailed(o.id);
  }
  for (const id of clases) deleteClase(id);
  for (const f of [F, VACIO, SOLO_NOTA]) {
    borrarAvisoDiario(f, "resumen");
    borrarAvisoDiario(f, "pase-lista");
    borrarPaseLista(f);
  }
  const conv = getOrCreateConversation(TELEFONO, "PRUEBA");
  deleteConversation(conv.id);
  check("limpieza: no queda nada en la cola con el teléfono de prueba",
    getPendingOutbox(200).every((o) => o.phone !== TELEFONO));
  check("limpieza: no quedan avisos de prueba", getAvisoDiario(F, "resumen") === null && getPaseLista(F) === null);
}

console.log(`\n${pass} bien, ${fail} mal`);
process.exit(fail === 0 ? 0 : 1);
