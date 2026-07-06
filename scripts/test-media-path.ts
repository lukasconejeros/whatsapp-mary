import "./env-loader.js";
import { esNombreMediaSeguro } from "../src/lib/media-path.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean) { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n}`); fail++; } }

console.log("\n🧪 TEST media-path (anti path traversal)\n");

// Seguros
check("basename normal .jpg", esNombreMediaSeguro("env_123_abc.jpg"));
check("basename .ogg", esNombreMediaSeguro("nota_1_x_voz.ogg"));

// Inseguros
check("rechaza ../../.env", !esNombreMediaSeguro("../../.env"));
check("rechaza ruta absoluta", !esNombreMediaSeguro("/etc/passwd"));
check("rechaza subcarpeta", !esNombreMediaSeguro("a/b.jpg"));
check("rechaza backslash", !esNombreMediaSeguro("..\\secreto"));
check("rechaza punto-punto", !esNombreMediaSeguro("foo/../bar.jpg"));
check("rechaza vacío", !esNombreMediaSeguro(""));
check("rechaza no-string", !esNombreMediaSeguro(123 as unknown));
check("rechaza null byte", !esNombreMediaSeguro("a\0.jpg"));

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
