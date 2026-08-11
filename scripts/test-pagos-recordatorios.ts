// Los PAGOS que vuelven cada mes y los RECORDATORIOS del calendario de Mary.
//
// Lukas, 10-08-2026: "que en calendario hayan pagos que también se repitan, que puede ser
// arriendo, suscripción, sueldos y otros —cuando ponga otros que aparezca una descripción—,
// (…) y recordatorios y ese también que ponga descripción".
//
// Decisiones suyas que estos candados protegen:
//  · Los pagos vuelven CADA MES, no cada semana (así se pagan de verdad).
//  · El pago del 31 NO se salta los meses cortos: cae el último día (febrero, abril…).
//  · Los recordatorios se le mandan por WhatsApp A MARY, nunca al apoderado, y solo se
//    marcan enviados cuando de verdad salieron (el "enviado falso" ya costó un incidente).
//
// Correr con: npm run test:pagos-recordatorios

import "./env-loader.js";
import {
  addPagoFijo, listPagosFijos, updatePagoFijo, deletePagoFijo, pagosFijosDeFecha,
  addRecordatorio, listRecordatorios, updateRecordatorio, deleteRecordatorio,
  recordatoriosDeFecha, marcarRecordatorioEnviado,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST pagos que vuelven cada mes y recordatorios\n");

// Limpieza por si una corrida anterior reventó a medias.
for (const p of listPagosFijos()) if (p.descripcion?.startsWith("PRUEBA")) deletePagoFijo(p.id);
for (const r of listRecordatorios("2026-01-01", "2027-12-31")) if (r.texto.startsWith("PRUEBA")) deleteRecordatorio(r.id);

// ── 1) Un pago que vuelve todos los meses ────────────────────────────────────
console.log("Pagos que se repiten");
const arriendo = addPagoFijo({ tipo: "arriendo", monto: 250000, diaMes: 5, descripcion: "PRUEBA arriendo del local" });
const creado = listPagosFijos().find((p) => p.id === arriendo);
check("se guarda el pago", !!creado);
check("guarda el monto", creado?.monto === 250000, String(creado?.monto));
check("guarda el día del mes", creado?.diaMes === 5, String(creado?.diaMes));
check("nace activo", creado?.activo === true);

const ago5 = pagosFijosDeFecha("2026-08-05").map((p) => p.id);
const sep5 = pagosFijosDeFecha("2026-09-05").map((p) => p.id);
const ago6 = pagosFijosDeFecha("2026-08-06").map((p) => p.id);
check("aparece el 5 de agosto", ago5.includes(arriendo));
check("aparece TAMBIÉN el 5 de septiembre (vuelve cada mes)", sep5.includes(arriendo));
check("NO aparece el 6 de agosto", !ago6.includes(arriendo));

// ── 2) El pago del 31 no se salta los meses cortos ───────────────────────────
const sueldos = addPagoFijo({ tipo: "sueldos", monto: 600000, diaMes: 31, descripcion: "PRUEBA sueldos" });
check("el 31 cae el 31 en agosto", pagosFijosDeFecha("2026-08-31").some((p) => p.id === sueldos));
check("el 31 cae el 28 en febrero (mes corto)", pagosFijosDeFecha("2027-02-28").some((p) => p.id === sueldos));
check("en febrero NO se cuela también el 27", !pagosFijosDeFecha("2027-02-27").some((p) => p.id === sueldos));
check("el 31 cae el 30 en abril", pagosFijosDeFecha("2027-04-30").some((p) => p.id === sueldos));
check("en abril NO se cuela también el 29", !pagosFijosDeFecha("2027-04-29").some((p) => p.id === sueldos));

// ── 3) "Otros" sin descripción no entra: es justo lo que él pidió que se pregunte ──
let rechazado = false;
try { addPagoFijo({ tipo: "otros", monto: 10000, diaMes: 1 }); } catch { rechazado = true; }
check("un pago 'otros' SIN descripción se rechaza", rechazado);
const otros = addPagoFijo({ tipo: "otros", monto: 10000, diaMes: 1, descripcion: "PRUEBA materiales" });
check("un pago 'otros' CON descripción sí entra", !!listPagosFijos().find((p) => p.id === otros));

// ── 4) Dar de baja no borra: no se pierde lo que se pagaba ───────────────────
updatePagoFijo(otros, { tipo: "otros", monto: 10000, diaMes: 1, descripcion: "PRUEBA materiales", activo: false });
check("un pago dado de baja no sale en el calendario", !pagosFijosDeFecha("2026-09-01").some((p) => p.id === otros));
check("…pero sigue en la lista de administración", !!listPagosFijos().find((p) => p.id === otros));

// ── 5) Recordatorios ─────────────────────────────────────────────────────────
console.log("\nRecordatorios");
const rec = addRecordatorio({ fecha: "2026-08-12", hora: "09:00", texto: "PRUEBA comprar acuarelas", avisar: true });
const guardado = listRecordatorios("2026-08-01", "2026-08-31").find((r) => r.id === rec);
check("se guarda el recordatorio", !!guardado);
check("guarda la hora", guardado?.hora === "09:00", String(guardado?.hora));
check("guarda la descripción tal cual", guardado?.texto === "PRUEBA comprar acuarelas");
check("nace sin hacer", guardado?.hecho === false);
check("nace SIN enviar (no hay 'enviado' falso)", guardado?.enviadoAt === null, String(guardado?.enviadoAt));

check("aparece el 12 de agosto", recordatoriosDeFecha("2026-08-12").some((r) => r.id === rec));
check("NO aparece el 13 (no se repite)", !recordatoriosDeFecha("2026-08-13").some((r) => r.id === rec));
check("NO sale fuera del rango pedido", !listRecordatorios("2026-09-01", "2026-09-30").some((r) => r.id === rec));

// El aviso solo se marca cuando de verdad salió el WhatsApp a Mary.
marcarRecordatorioEnviado(rec);
const enviado = recordatoriosDeFecha("2026-08-12").find((r) => r.id === rec);
check("al mandarlo queda la marca con la hora real", typeof enviado?.enviadoAt === "number" && (enviado?.enviadoAt ?? 0) > 0);

updateRecordatorio(rec, { fecha: "2026-08-12", hora: "10:30", texto: "PRUEBA comprar acuarelas y pinceles", avisar: false, hecho: true });
const editado = recordatoriosDeFecha("2026-08-12").find((r) => r.id === rec);
check("se puede editar el texto y la hora", editado?.hora === "10:30" && editado?.texto.includes("pinceles"));
check("se puede marcar como hecho", editado?.hecho === true);
check("se puede apagar el aviso por WhatsApp", editado?.avisar === false);

// ── 6) Limpieza ──────────────────────────────────────────────────────────────
deletePagoFijo(arriendo); deletePagoFijo(sueldos); deletePagoFijo(otros); deleteRecordatorio(rec);
check("se borran los pagos de prueba", !listPagosFijos().some((p) => p.descripcion?.startsWith("PRUEBA")));
check("se borra el recordatorio de prueba", !listRecordatorios("2026-01-01", "2027-12-31").some((r) => r.texto.startsWith("PRUEBA")));

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
