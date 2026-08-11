// El ENVÍO de verdad de los recordatorios de Mary: de la tabla al outbox de
// WhatsApp, y de ahí a "enviado" solo cuando el mensaje salió.
//
// El candado que importa (ya costó un incidente en la app de Lukas): 'enviado_at'
// NO se escribe al encolar, sino cuando el outbox confirma que WhatsApp lo mandó.
//
// Correr con: npm run test:recordatorios-envio
import "./env-loader.js";
import {
  addRecordatorio, listRecordatorios, deleteRecordatorio, recordatoriosDeFecha,
  getPendingOutbox, markOutboxSent, markOutboxFailed,
  getOrCreateConversation, deleteConversation,
} from "../src/lib/db.js";
import { tickRecordatoriosWa } from "../src/lib/recordatorios-wa-loop.js";
import { todaySantiago, nowSantiago } from "../src/lib/fechas.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST envío de los recordatorios de Mary por WhatsApp\n");

const HOY = todaySantiago();
const AHORA = nowSantiago().slice(11); // HH:MM
const TELEFONO = "56900000099"; // el propio número del bot, falso para la prueba

// Limpieza de corridas anteriores.
for (const r of listRecordatorios("2026-01-01", "2027-12-31")) {
  if (r.texto.startsWith("PRUEBA")) deleteRecordatorio(r.id);
}
const buscar = (id: number) => recordatoriosDeFecha(HOY).find((r) => r.id === id);

// ── 1) Sin WhatsApp conectado no se encola nada ─────────────────────────────
console.log("WhatsApp caído");
const id = addRecordatorio({ fecha: HOY, hora: AHORA, texto: "PRUEBA llamar a la profe Paula" });
check("desconectado → no encola", tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: null }).encolados === 0);
check("desconectado → sigue sin enviar", buscar(id)?.enviadoAt === null);

// ── 2) Se encola, pero NO se da por enviado ─────────────────────────────────
console.log("\nSe encola en el outbox");
const r1 = tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: TELEFONO });
check("encola 1", r1.encolados === 1, JSON.stringify(r1));
const enColaId = buscar(id)?.outboxId ?? null;
check("guarda el número de la cola", typeof enColaId === "number", String(enColaId));
check("todavía NO figura como enviado", buscar(id)?.enviadoAt === null);
const enCola = getPendingOutbox(50).find((o) => o.id === enColaId);
check("el mensaje va al teléfono de Mary", enCola?.phone === TELEFONO, enCola?.phone);
check("el mensaje dice lo que ella escribió",
  enCola?.content.includes("llamar a la profe Paula") === true, enCola?.content);

// ── 3) No se encola dos veces ───────────────────────────────────────────────
console.log("\nIdempotencia");
check("segunda pasada no lo encola de nuevo",
  tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: TELEFONO }).encolados === 0);

// ── 4) Cuando WhatsApp lo manda, recién ahí queda enviado ───────────────────
console.log("\nWhatsApp lo despacha");
markOutboxSent(enColaId as number);
const r2 = tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: TELEFONO });
check("confirma 1", r2.confirmados === 1, JSON.stringify(r2));
check("ahora sí figura enviado", typeof buscar(id)?.enviadoAt === "number", String(buscar(id)?.enviadoAt));
check("y no se manda otra vez",
  tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: TELEFONO }).encolados === 0);

// ── 5) Si el envío fracasa, se puede reintentar ─────────────────────────────
console.log("\nSi WhatsApp lo rechaza");
const id2 = addRecordatorio({ fecha: HOY, hora: AHORA, texto: "PRUEBA comprar arcilla" });
tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: TELEFONO });
const cola2 = buscar(id2)?.outboxId as number;
markOutboxFailed(cola2);
const r3 = tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: TELEFONO });
check("no lo da por enviado", buscar(id2)?.enviadoAt === null);
check("lo suelta y lo vuelve a encolar", r3.encolados === 1 && buscar(id2)?.outboxId !== cola2,
  JSON.stringify({ r3, ahora: buscar(id2)?.outboxId, antes: cola2 }));

// ── 6) Los que ella no quiere que avisen ────────────────────────────────────
console.log("\nSin aviso");
const id3 = addRecordatorio({ fecha: HOY, hora: AHORA, texto: "PRUEBA sin aviso", avisar: false });
tickRecordatoriosWa({ hoy: HOY, ahora: AHORA, phone: TELEFONO });
check("el que no avisa nunca se encola", buscar(id3)?.outboxId == null);

// ── Limpieza ────────────────────────────────────────────────────────────────
// Importa de verdad: sin esto quedan envíos VIVOS en la cola con un teléfono
// falso, y el bot los mandaría al conectarse. Se descartan y se borra el chat.
for (const r of listRecordatorios("2026-01-01", "2027-12-31")) {
  if (r.texto.startsWith("PRUEBA")) deleteRecordatorio(r.id);
}
for (const o of getPendingOutbox(200)) if (o.phone === TELEFONO) markOutboxFailed(o.id);
deleteConversation(getOrCreateConversation(TELEFONO).id);
check("no queda ningún envío de prueba en la cola",
  getPendingOutbox(200).every((o) => o.phone !== TELEFONO));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasadas, ${fail} fallidas\n`);
process.exit(fail === 0 ? 0 : 1);
