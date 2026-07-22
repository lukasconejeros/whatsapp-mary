import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import { recordLid, resolverLid } from "../src/lib/db.js";
import { registrarEnvioOutbox, fueEnvioOutbox } from "../src/lib/baileys/eco.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST monitor de salientes (eco del outbox + mapeo @lid)\n");

const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));

// 1) Eco del outbox: un id registrado se reconoce (para ignorar su eco); uno ajeno no.
registrarEnvioOutbox("WAID_DEL_BOT_123");
check("id enviado por el bot → fueEnvioOutbox true", fueEnvioOutbox("WAID_DEL_BOT_123"));
check("id ajeno (escrito por Mary) → false", !fueEnvioOutbox("WAID_DE_MARY_999"));
check("re-consulta sigue true (eco puede repetirse en reconexión)", fueEnvioOutbox("WAID_DEL_BOT_123"));

// 2) Mapeo @lid → número real.
const LID = "999000111222333";
raw.prepare("DELETE FROM lid_map WHERE lid = ?").run(LID);
check("@lid desconocido → null", resolverLid(LID) === null);
recordLid(LID, "56912345678");
check("tras aprender → devuelve el número real", resolverLid(LID) === "56912345678");
recordLid(LID, "56999999999"); // se actualiza si cambia
check("recordLid actualiza el número", resolverLid(LID) === "56999999999");

// Limpieza.
raw.prepare("DELETE FROM lid_map WHERE lid = ?").run(LID);
raw.close();

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
