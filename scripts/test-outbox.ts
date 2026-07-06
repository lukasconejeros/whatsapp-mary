import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import type { WASocket } from "@whiskeysockets/baileys";
import { getOrCreateConversation, enqueueOutbox, getPendingOutbox } from "../src/lib/db.js";
import { startOutboxLoop, stopOutboxLoop } from "../src/lib/baileys/outbox.js";

const db = new Database(path.resolve(process.cwd(), "data/messages.db"));
db.prepare("DELETE FROM outbox WHERE sent = 0").run(); // limpiar cola de pruebas previas

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") {
  if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; }
}

async function main() {
  console.log("\n🧪 TEST outbox (reentrada / poison-pill)\n");

  // 1) Reentrada: 1 item con sendMessage LENTO (3s) no debe duplicarse.
  const conv = getOrCreateConversation("56990009999", "Prueba Outbox");
  enqueueOutbox(conv.id, conv.phone, "hola-reentrada");

  let calls = 0;
  const lentoSock = { sendMessage: async () => { calls++; await delay(3000); } } as unknown as WASocket;
  startOutboxLoop(lentoSock);
  await delay(5500); // con setInterval(2s) la versión vieja enviaría ≥2 veces
  stopOutboxLoop();
  await delay(200);
  check("envío único con sendMessage lento (sin duplicado)", calls === 1, `calls=${calls}`);
  check("item marcado como enviado", getPendingOutbox(50).filter((o) => o.conversation_id === conv.id).length === 0);

  // 2) Poison-pill: item que SIEMPRE falla se descarta a los 5 intentos y no bloquea.
  db.prepare("DELETE FROM outbox WHERE sent = 0").run();
  const veneno = enqueueOutbox(conv.id, conv.phone, "veneno");
  let intentos = 0;
  const malSock = { sendMessage: async () => { intentos++; throw new Error("falla siempre"); } } as unknown as WASocket;
  startOutboxLoop(malSock);
  await delay(13000); // 6 pasadas de ~2s: debe agotar los 5 intentos
  stopOutboxLoop();
  await delay(200);
  const filaVeneno = db.prepare("SELECT sent, attempts FROM outbox WHERE id = ?").get(veneno) as { sent: number; attempts: number };
  check("item venenoso marcado como fallido (sent=2)", filaVeneno?.sent === 2, JSON.stringify(filaVeneno));
  check("no reintenta infinito (attempts topado en 5)", filaVeneno?.attempts === 5, JSON.stringify(filaVeneno));
  check("no vuelve en getPendingOutbox", getPendingOutbox(50).every((o) => o.id !== veneno));

  // 3) La cola sigue viva: un item bueno tras el venenoso SÍ se envía.
  const bueno = enqueueOutbox(conv.id, conv.phone, "bueno-despues");
  let okCalls = 0;
  const okSock = { sendMessage: async () => { okCalls++; } } as unknown as WASocket;
  startOutboxLoop(okSock);
  await delay(2600);
  stopOutboxLoop();
  await delay(200);
  check("item bueno posterior se envía (cola no bloqueada)", okCalls >= 1 && getPendingOutbox(50).every((o) => o.id !== bueno));

  console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
  db.prepare("DELETE FROM conversations WHERE phone = '56990009999'").run();
  db.close();
  process.exit(fail === 0 ? 0 : 1);
}

main();
