// TEST del botón "Generar código QR nuevo".
// Reproduce el fallo real de producción: en EasyPanel `auth/` es un volumen montado y
// borrar la CARPETA lanza EBUSY, lo que abortaba la petición antes de avisar al motor.
import fs from "fs";
import os from "os";
import path from "path";
import { vaciarAuth, pedirReinicioQR } from "../src/lib/reinicio-qr.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") {
  if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; }
}

console.log("\n🧪 TEST regenerar QR (volumen montado)\n");

// 1) Vacía las credenciales PERO deja la carpeta en pie (es el punto de montaje).
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "test-qr-"));
const authDir = path.join(raiz, "auth");
const dataDir = path.join(raiz, "data");
fs.mkdirSync(authDir, { recursive: true });
fs.writeFileSync(path.join(authDir, "creds.json"), "{}");
fs.mkdirSync(path.join(authDir, "keys"));
fs.writeFileSync(path.join(authDir, "keys", "k1.json"), "{}");

const r1 = vaciarAuth(authDir);
check("borra las credenciales de dentro", fs.readdirSync(authDir).length === 0, `quedan ${fs.readdirSync(authDir).length}`);
check("NO borra la carpeta auth (es el volumen montado)", fs.existsSync(authDir));
check("informa de lo borrado", r1.borradas === 2 && r1.fallos === 0, JSON.stringify(r1));

// 2) Carpeta inexistente: no lanza (el bot puede arrancar sin haberse vinculado nunca).
let lanzo = false;
try { vaciarAuth(path.join(raiz, "no-existe")); } catch { lanzo = true; }
check("carpeta inexistente no rompe nada", !lanzo);

// 3) EL CASO DEL BUG: un fichero ocupado (como el volumen montado) NO impide avisar al motor.
fs.writeFileSync(path.join(authDir, "creds.json"), "{}");
const fd = fs.openSync(path.join(authDir, "creds.json"), "r"); // handle abierto: Windows lo bloquea
let lanzo2 = false;
try { vaciarAuth(authDir); } catch { lanzo2 = true; }
fs.closeSync(fd);
check("un fichero bloqueado no lanza excepción", !lanzo2);

pedirReinicioQR(dataDir);
check("la señal de reinicio SÍ queda escrita (esto es lo que fallaba)", fs.existsSync(path.join(dataDir, ".restart")));

// 4) La señal se puede pedir aunque data/ no exista aún.
const dataNuevo = path.join(raiz, "data-nuevo");
pedirReinicioQR(dataNuevo);
check("crea data/ si no existe", fs.existsSync(path.join(dataNuevo, ".restart")));

fs.rmSync(raiz, { recursive: true, force: true });
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} ok, ${fail} fallos\n`);
process.exit(fail === 0 ? 0 : 1);
