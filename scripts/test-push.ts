import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import { addPushSub, listPushSubs, deletePushSub } from "../src/lib/db.js";
import { enviarPush, pushConfigurado } from "../src/lib/push.js";

// Fuerza el init de la DB (crea la tabla push_subs) antes de tocarla con conexión cruda.
listPushSubs();
const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
raw.prepare("DELETE FROM push_subs WHERE endpoint LIKE 'https://test.local/%'").run();

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

async function main() {
  console.log("\n🧪 TEST push (suscripciones + no-op sin VAPID)\n");

  // DB round-trip
  addPushSub({ endpoint: "https://test.local/a", p256dh: "clave1", auth: "auth1" });
  addPushSub({ endpoint: "https://test.local/b", p256dh: "clave2", auth: "auth2" });
  let subs = listPushSubs().filter(s => s.endpoint.startsWith("https://test.local/"));
  check("guarda 2 suscripciones", subs.length === 2, String(subs.length));

  // upsert por endpoint (no duplica)
  addPushSub({ endpoint: "https://test.local/a", p256dh: "clave1b", auth: "auth1b" });
  subs = listPushSubs().filter(s => s.endpoint.startsWith("https://test.local/"));
  check("upsert no duplica (sigue 2)", subs.length === 2, String(subs.length));
  check("upsert actualiza las claves", subs.find(s => s.endpoint.endsWith("/a"))?.p256dh === "clave1b");

  // delete
  deletePushSub("https://test.local/a");
  subs = listPushSubs().filter(s => s.endpoint.startsWith("https://test.local/"));
  check("borra una suscripción", subs.length === 1);

  // no-op sin VAPID (si no hay claves configuradas en el entorno)
  if (!process.env.VAPID_PUBLIC_KEY) {
    check("sin VAPID: pushConfigurado = false", pushConfigurado() === false);
    let lanzo = false;
    try { await enviarPush({ titulo: "x", cuerpo: "y" }); } catch { lanzo = true; }
    check("sin VAPID: enviarPush no lanza (no-op)", !lanzo);
  } else {
    console.log("  (VAPID presente en el entorno; se omite el test de no-op)");
  }

  // limpieza
  raw.prepare("DELETE FROM push_subs WHERE endpoint LIKE 'https://test.local/%'").run();
  raw.close();
  console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
