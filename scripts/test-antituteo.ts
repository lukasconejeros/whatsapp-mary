// TEST de la regla ANTITUTEO (encargo de Lukas, 24-08-2026).
//
// POR QUÉ EXISTE: Mary escribió su saludo tratando de usted ("cuéntame cuál es SU nombre") y el
// bot lo mandó tuteando ("cuál es TU nombre"), además de saludar con un "¡Hola como estai!" que
// copió del ejemplo de charla personal del propio prompt. Ella lo corrigió a mano (conv 365,
// 24-08 12:29). Decisión de Lukas: el bot trata de USTED a todo el mundo, siempre, en todos los
// chats — apoderados de años incluidos.
//
// Lo que cuida este test: los textos que escribimos NOSOTROS (los fijos del código y los ejemplos
// del prompt). Lo que improvisa el modelo no se puede probar acá; para eso está la orden dura en
// el prompt, y se mide mirando conversaciones reales.
import "./env-loader.js";
import { readFileSync } from "node:fs";
import { detectarTuteo } from "../src/lib/antituteo.js";
import { FRASE_ESPERA } from "../src/lib/interes-prueba.js";
import { DEFAULT_BIENVENIDA } from "../src/lib/mensajes.js";
import { buildSystemPrompt } from "../src/lib/system-prompt.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST de la regla antituteo\n");

// ── El detector ──────────────────────────────────────────────────────────────
console.log("— qué cuenta como tutear —");
check("«cuéntame cuál es tu nombre» tutea", detectarTuteo("cuéntame cuál es tu nombre").length > 0);
check("«¿tienes tiempo?» tutea", detectarTuteo("¿tienes tiempo?").length > 0);
check("«te confirmo la hora» tutea", detectarTuteo("te confirmo la hora").length > 0);
check("«¿qué te parece?» tutea", detectarTuteo("¿qué te parece?").length > 0);
check("«como estai» tutea (chileno)", detectarTuteo("hola, ¿cómo estai?").length > 0);
check("«puedes traerla» tutea", detectarTuteo("puedes traerla el martes").length > 0);
check("«dime la edad» tutea", detectarTuteo("dime la edad de la niña").length > 0);

check("«cuénteme cuál es su nombre» NO tutea", detectarTuteo("cuénteme cuál es su nombre").length === 0);
check("«¿tiene tiempo?» NO tutea", detectarTuteo("¿tiene tiempo?").length === 0);
check("«le confirmo la hora» NO tutea", detectarTuteo("le confirmo la hora").length === 0);
check("«ustedes pueden venir» NO tutea (plural de usted)", detectarTuteo("ustedes pueden venir el sábado").length === 0);
check("un texto sin verbos no tutea", detectarTuteo("Picarte 804, Valdivia, segundo piso").length === 0);
// El detector mira palabras enteras: nada de cazar el «te» de «taller» o el «tu» de «estudio».
check("«el taller de estudio» NO tutea", detectarTuteo("el taller de estudio abre a las 17:30").length === 0);

// ── Los textos fijos que manda el sistema (no los escribe el modelo) ─────────
console.log("\n— los textos fijos del bot tratan de usted —");
check(`la frase de espera: «${FRASE_ESPERA}»`, detectarTuteo(FRASE_ESPERA).length === 0, JSON.stringify(detectarTuteo(FRASE_ESPERA)));
check("el saludo de fábrica", detectarTuteo(DEFAULT_BIENVENIDA).length === 0, JSON.stringify(detectarTuteo(DEFAULT_BIENVENIDA)));

// ── El cerebro del bot ───────────────────────────────────────────────────────
console.log("\n— la orden está dentro del cerebro del bot —");
const cerebro = buildSystemPrompt();
check("el prompt manda tratar de usted", /trata(s)? de usted|de USTED|nunca tutees/i.test(cerebro));
check(
  "y el ejemplo «hola Mary como estai» ya no está (de ahí copió el saludo)",
  !/como estai/i.test(cerebro)
);

// Las frases de ejemplo que el prompt pone como "esto es lo que dices": si alguna tutea, el
// modelo la copia tal cual. Son las que salieron tuteando el 24-08.
const negocio = readFileSync("prompts/negocio.md", "utf8");
check("«Mary te contesta en un rato» ya no está", !/Mary te contesta/i.test(negocio));
check("«te confirma la hora» ya no está", !/te confirma la hora/i.test(negocio));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} ok, ${fail} fallando\n`);
process.exit(fail === 0 ? 0 : 1);
