import { normalizeChilePhone } from "../src/lib/phone.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST phone normalize\n");
check("celular con +56 y espacios", normalizeChilePhone("+56 9 9906 6071") === "56999066071");
check("celular sin prefijo país (9 dígitos)", normalizeChilePhone("999066071") === "56999066071", `(=${normalizeChilePhone("999066071")})`);
check("ya canónico", normalizeChilePhone("56999066071") === "56999066071");
check("con guiones y paréntesis", normalizeChilePhone("(569) 9906-6071") === "56999066071", `(=${normalizeChilePhone("(569) 9906-6071")})`);
check("JID phone tal cual", normalizeChilePhone("56912345678") === "56912345678");
check("basura → null", normalizeChilePhone("hola") === null);
check("vacío → null", normalizeChilePhone("") === null);

console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
