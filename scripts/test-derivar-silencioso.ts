/**
 * DERIVAR SIN DECIR NADA (08-09-2026).
 *
 * Lo cazó la prueba contra el modelo real: ante "mi hijo tiene autismo nivel 1", el manual manda
 * apagarse en silencio, pero el bot contestó **"Le paso con una persona del equipo, le escribe
 * enseguida."** Esa frase no la eligió el modelo: se la ORDENA el código, en la instrucción que
 * devuelve la tool derivarHumano. Un manual no puede ganarle a una orden que llega después.
 *
 * Y además esa frase no suena a Mary ni de lejos: "una persona del equipo" en el WhatsApp donde
 * la persona cree que habla con la dueña.
 *
 * Desde ahora derivarHumano acepta `silencioso`. Con él, la instrucción que vuelve al modelo es
 * la contraria: no escribas nada.
 *
 *   npx tsx scripts/test-derivar-silencioso.ts
 */
import "./env-loader.js";
import { derivarHumano, derivarHumanoDefinition } from "../src/lib/tools/derivar-humano";
import { getOrCreateConversation, getConversationById, setModeAutomatico, deleteConversation } from "../src/lib/db.js";

let pass = 0, fail = 0;
function ok(cond: boolean, msg: string, extra = "") {
  if (cond) { console.log(`  ✅ ${msg}`); pass++; }
  else { console.log(`  ❌ ${msg} ${extra}`); fail++; }
}

console.log("\n🧪 Derivar en silencio ante un tema delicado\n");

const props = derivarHumanoDefinition.function.parameters.properties as Record<string, unknown>;
ok("silencioso" in props, "el modelo puede pedir el silencio (está en el esquema de la tool)");

const conv = getOrCreateConversation("56990008888", "Prueba Derivar");
setModeAutomatico(conv.id, "AI");

const delicado = await derivarHumano({ razon: "tema delicado", silencioso: true, conversationId: conv.id });
const inst = String(delicado.instruccion ?? "");
ok(!/responde al usuario/i.test(inst), "no le manda escribir nada", inst);
ok(/no escribas/i.test(inst), "le dice expresamente que no escriba", inst);
ok(getConversationById(conv.id)?.mode === "HUMAN", "y el chat queda para Mary");

setModeAutomatico(conv.id, "AI");
const normal = await derivarHumano({ razon: "quiere agendar", conversationId: conv.id });
const inst2 = String(normal.instruccion ?? "");
ok(/responde al usuario/i.test(inst2), "derivar normal SIGUE pidiendo un mensaje para la persona", inst2);
ok(getConversationById(conv.id)?.mode === "HUMAN", "y también deja el chat para Mary");

deleteConversation(conv.id);
ok(getConversationById(conv.id) === null, "limpieza: conversación de prueba borrada");

console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
