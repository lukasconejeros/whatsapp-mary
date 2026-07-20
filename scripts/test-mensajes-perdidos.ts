import "./env-loader.js";
import Database from "better-sqlite3";
import path from "path";
import { markMessageProcessed, unmarkMessageProcessed } from "../src/lib/db.js";
import { recordarSaliente, recuperarSaliente } from "../src/lib/baileys/msg-cache.js";
import type { proto } from "@whiskeysockets/baileys";

// Cubre el arreglo de "no llegan todos los mensajes":
//   A) dedup por id de WhatsApp → permite procesar los "append" (re-entrega tras
//      reconexión/deploy) SIN duplicar los que ya se guardaron.
//   B) liberación del id cuando el mensaje llegó ilegible (Bad MAC), para que el
//      reenvío ya descifrado (mismo id) NO se descarte como duplicado.
//   C) caché de salientes que alimenta getMessage (reenvío a quien no pudo descifrar).

// Primero una llamada a db.ts: crea/actualiza el esquema (incl. processed_msgs) en la
// base existente. Verifica de paso que la tabla nueva aparece sola, sin migrar a mano.
markMessageProcessed("TEST_WARMUP");

const raw = new Database(path.resolve(process.cwd(), "data/messages.db"));
const IDS = ["TEST_WA_ID_A", "TEST_WA_ID_B", "TEST_WA_ID_C", "TEST_WARMUP"];
for (const id of IDS) raw.prepare("DELETE FROM processed_msgs WHERE wa_id = ?").run(id);

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") {
  if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; }
}

console.log("\n🧪 TEST mensajes perdidos (append / dedup / Bad MAC / caché salientes)\n");

// A) Dedup: primera vez nuevo, segunda vez ya procesado.
check("mensaje nuevo se acepta", markMessageProcessed("TEST_WA_ID_A") === true);
check("mismo mensaje NO se procesa dos veces (sin duplicar)", markMessageProcessed("TEST_WA_ID_A") === false);
check("otro mensaje distinto sí se acepta", markMessageProcessed("TEST_WA_ID_B") === true);

// B) Bad MAC: se libera el id y el reenvío descifrado se procesa.
markMessageProcessed("TEST_WA_ID_C");
unmarkMessageProcessed("TEST_WA_ID_C");
check("tras liberar el ilegible, el reenvío SÍ se procesa", markMessageProcessed("TEST_WA_ID_C") === true);
// Liberar un id que no existe no debe reventar.
let exploto = false;
try { unmarkMessageProcessed("NO_EXISTE_XYZ"); } catch { exploto = true; }
check("liberar un id inexistente no rompe", exploto === false);

// C) Caché de salientes (lo que usa getMessage).
const fake = { conversation: "hola, soy Mary" } as proto.IMessage;
recordarSaliente("SALIENTE_1", fake);
check("recupera el saliente guardado", recuperarSaliente("SALIENTE_1")?.conversation === "hola, soy Mary");
check("id desconocido devuelve undefined", recuperarSaliente("NO_GUARDADO") === undefined);
check("id nulo no rompe", recuperarSaliente(null) === undefined);
recordarSaliente(null, fake);          // no debe romper
recordarSaliente("SALIENTE_2", null);  // no debe romper
check("guardar con id/mensaje nulo no rompe", recuperarSaliente("SALIENTE_2") === undefined);

// La caché no crece sin fin (tope 800): el más viejo se descarta.
for (let i = 0; i < 850; i++) recordarSaliente(`BULK_${i}`, fake);
check("la caché descarta los más viejos (tope 800)", recuperarSaliente("BULK_0") === undefined);
check("la caché conserva los más recientes", recuperarSaliente("BULK_849")?.conversation === "hola, soy Mary");

for (const id of IDS) raw.prepare("DELETE FROM processed_msgs WHERE wa_id = ?").run(id);
raw.close();

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
