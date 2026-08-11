// La CACHÉ DEL PROMPT: el prompt del sistema (6.754 tokens medidos el 10-08-2026)
// se manda igual en cada mensaje de la conversación y hoy se paga entero cada vez.
// Marcándolo como cacheable, de la segunda llamada en adelante se paga al 10%.
//
// La regla que estos candados protegen: lo CACHEADO tiene que ser byte a byte igual
// entre llamadas. Por eso el estado del turno —que cambia en cada mensaje— va en un
// bloque APARTE y DESPUÉS, nunca pegado al prompt: si se mezclan, la caché no sirve
// de nada y encima se paga el recargo de escribirla.
//
// Correr con: npm run test:cache-prompt
import "./env-loader.js";
import { mensajesDeSistema, esErrorDeCache } from "../src/lib/ai.js";
import { cuerpoEnsayo } from "../src/lib/ensayo.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST caché del prompt del sistema\n");

const SYS = "Eres la asistente de Arteluk. ".repeat(50);
const ESTADO = "[ESTADO_TURNO: preguntando_horario]";
const msgs = mensajesDeSistema(SYS, ESTADO);
const bloques = msgs[0].content as unknown as { type: string; text: string; cache_control?: unknown }[];

console.log("— cómo se arma —");
check("va un solo mensaje de sistema", msgs.length === 1, String(msgs.length));
check("partido en 2 bloques", Array.isArray(bloques) && bloques.length === 2, JSON.stringify(bloques)?.slice(0, 120));
check("el prompt estable va PRIMERO", bloques[0]?.text === SYS);
check("el estado del turno va DESPUÉS", bloques[1]?.text === ESTADO);

console.log("\n— qué se cachea —");
check("el prompt estable se marca como cacheable",
  JSON.stringify(bloques[0]?.cache_control) === JSON.stringify({ type: "ephemeral" }),
  JSON.stringify(bloques[0]?.cache_control));
check("el estado del turno NO se cachea (cambia cada mensaje)",
  bloques[1]?.cache_control === undefined, JSON.stringify(bloques[1]?.cache_control));

console.log("\n— no se pierde nada de lo que decía antes —");
const plano = bloques.map((b) => b.text).join("\n\n");
check("junto dice lo mismo que se mandaba antes", plano === SYS + "\n\n" + ESTADO);

console.log("\n— red de seguridad: si el proveedor no quiere la caché —");
check("un error de cache_control se reconoce",
  esErrorDeCache(new Error("400 Invalid parameter: cache_control is not supported")));
check("uno de bloques de contenido también",
  esErrorDeCache(new Error("Invalid content block: unexpected field cache_control")));
check("un 401 NO se confunde con eso (hay que verlo, no taparlo)",
  !esErrorDeCache(new Error("401 Unauthorized: invalid api key")));
check("un 429 tampoco", !esErrorDeCache(new Error("429 rate limit exceeded")));
check("quedarse sin saldo tampoco", !esErrorDeCache(new Error("402 insufficient credits balance")));

console.log("\n— sin caché queda como antes —");
const plana = mensajesDeSistema(SYS, ESTADO, false);
check("apagada, vuelve al texto de siempre en un solo bloque",
  plana[0].content === SYS + "\n\n" + ESTADO, String(plana[0].content).slice(0, 60));

// ── El otro camino: la práctica de Mary, que va directo a Anthropic ──────────
console.log("\n— la práctica de Mary (Anthropic directo) —");
const cuerpo = cuerpoEnsayo(SYS, [{ role: "user", content: "hola" }]) as unknown as {
  system: { type: string; text: string; cache_control?: unknown }[];
};
check("el prompt va en bloque, no en texto suelto", Array.isArray(cuerpo.system), typeof cuerpo.system);
check("y se marca como cacheable",
  JSON.stringify(cuerpo.system?.[0]?.cache_control) === JSON.stringify({ type: "ephemeral" }),
  JSON.stringify(cuerpo.system?.[0]?.cache_control));
check("dice exactamente el mismo prompt de antes", cuerpo.system?.[0]?.text === SYS);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasadas, ${fail} fallidas\n`);
process.exit(fail === 0 ? 0 : 1);
