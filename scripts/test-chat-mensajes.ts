import { addChatMensaje, listChatMensajes } from "../src/lib/db";

let fails = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) fails++;
}

addChatMensaje("user", "hola");
addChatMensaje("asistente", "¡hola! ¿en qué te ayudo?");
const all = listChatMensajes();

check("hay al menos 2 mensajes", all.length >= 2);
const lastTwo = all.slice(-2);
check("orden cronológico: user antes que asistente", lastTwo[0].rol === "user" && lastTwo[1].rol === "asistente");
check("guarda el texto", lastTwo[0].texto === "hola");
check("rol válido", lastTwo[1].rol === "asistente");

const limited = listChatMensajes(1);
check("limit recorta a 1", limited.length === 1);
check("limit devuelve el más reciente", limited[0].texto === "¡hola! ¿en qué te ayudo?");

console.log(fails === 0 ? "\nTODOS OK" : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
