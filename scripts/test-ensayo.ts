import "./env-loader.js";
import {
  addEnsayoMensaje, listEnsayoMensajes, limpiarEnsayo,
  marcarEnsayoMalo, listEnsayoMalos, getMessages, getOrCreateConversation,
} from "../src/lib/db.js";
import { simularHerramienta, demoraRealMs } from "../src/lib/ensayo.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean) { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n}`); fail++; } }

console.log("\n🧪 TEST chat de ensayo\n");

limpiarEnsayo();

console.log("— Guardar y leer la práctica —");
addEnsayoMensaje("apoderado", "Hola, quiero información");
const idBot = addEnsayoMensaje("bot", "Hola, ¿para quién sería la clase?", ["Aquí te habría pasado la conversación a ti."]);
const lista = listEnsayoMensajes();
check("guarda los dos turnos", lista.length === 2);
check("el primero es del apoderado", lista[0].rol === "apoderado");
check("quedan en orden de conversación", lista[0].id < lista[1].id);
check("guarda lo que HABRÍA hecho", (lista[1].acciones ?? "").includes("pasado la conversación"));
check("sin marcar por defecto", lista[1].malo === 0);

console.log("\n— 'Esto yo no lo diría' —");
check("marca una respuesta del bot", marcarEnsayoMalo(idBot, true));
check("queda marcada", listEnsayoMensajes()[1].malo === 1);
check("aparece en la lista para afinar el cerebro", listEnsayoMalos().length === 1);
check("se puede desmarcar", marcarEnsayoMalo(idBot, false) && listEnsayoMalos().length === 0);
// Marcar un mensaje del apoderado no tiene sentido: solo se corrige al bot.
check("no marca lo que escribió el apoderado", !marcarEnsayoMalo(lista[0].id, true));

console.log("\n— El ensayo NO toca las conversaciones reales —");
const conv = getOrCreateConversation("56900000009", "Contacto real de prueba");
const antes = getMessages(conv.id).length;
addEnsayoMensaje("apoderado", "otro mensaje de práctica");
check("la conversación real no cambia", getMessages(conv.id).length === antes);
check("empezar de nuevo borra la práctica", limpiarEnsayo() > 0 && listEnsayoMensajes().length === 0);
check("y la conversación real sigue intacta", getMessages(conv.id).length === antes);

console.log("\n— Las herramientas se simulan, no se ejecutan —");
const der = simularHerramienta("derivarHumano", { razon: "quiere agendar" });
check("derivar avisa que te pasaría la conversación", der.aviso.includes("pasado la conversación"));
check("y muestra la razón", der.aviso.includes("quiere agendar"));
check("el modelo recibe que salió bien", der.resultado.ok === true);
check("silenciar avisa que no contestaría", simularHerramienta("silenciar", {}).aviso.includes("no habría contestado"));
check("marcar interés avisa", simularHerramienta("marcar_interes", {}).aviso.includes("interesado"));
check("guardar datos nombra a la persona", simularHerramienta("guardarLead", { nombre: "Carolina" }).aviso.includes("Carolina"));
check("una herramienta desconocida no revienta", simularHerramienta("inventada", {}).resultado.ok === false);

console.log("\n— La demora es la real del bot, no una inventada —");
const d = demoraRealMs(0);
check("nunca contesta al instante", d >= 25000);
check("cae en el rango real (25-29 s)", d >= 25000 && demoraRealMs(1) <= 29000);
check("varía entre una respuesta y otra", demoraRealMs(0) !== demoraRealMs(1));

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
