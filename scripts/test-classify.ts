import "./env-loader.js";
import { extractCtwaReferral, classifyCategoria } from "../src/lib/classify.js";
import { upsertCliente } from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST classify (CTWA + reglas)\n");

// extractCtwaReferral
const adMsg = {
  extendedTextMessage: {
    text: "Hola, vi su anuncio",
    contextInfo: {
      entryPointConversionSource: "ctwa_ad",
      externalAdReply: { title: "Clases de arte", body: "Inscríbete", sourceId: "120xyz", sourceUrl: "https://fb.me/x" },
    },
  },
};
const ref = extractCtwaReferral(adMsg);
check("detecta CTWA en externalAdReply", !!ref && ref.sourceId === "120xyz", `(${JSON.stringify(ref)})`);

const plain = { conversation: "hola" };
check("mensaje normal NO es CTWA", extractCtwaReferral(plain) === null);

const empty = extractCtwaReferral(null);
check("mensaje nulo NO es CTWA", empty === null);

// classifyCategoria (reglas en orden)
check("con CTWA → potencial", classifyCategoria({ phone: "56900000010", ctwaReferral: ref }) === "potencial");

upsertCliente({ nombre: "Cliente Real", telefono: "56900000011" });
check("número en clientes → arteluk", classifyCategoria({ phone: "56900000011", ctwaReferral: null }) === "arteluk");

check("desconocido sin CTWA → mary (default)", classifyCategoria({ phone: "56900000012", ctwaReferral: null }) === "mary");

check("CTWA gana sobre cliente conocido", classifyCategoria({ phone: "56900000011", ctwaReferral: ref }) === "potencial");

console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
