import "./env-loader.js";
import { buildSystemPrompt } from "../src/lib/system-prompt.js";
import { toolDefinitions } from "../src/lib/tools/index.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean) { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n}`); fail++; } }

console.log("\n🧪 TEST cerebro de Arteluk (prompts/negocio.md)\n");

const p = buildSystemPrompt();
const bajo = p.toLowerCase();

console.log("— Es el cerebro del taller, no el de Orion —");
check("carga el prompt (no cae al fallback)", p.length > 1000);
check("habla de Arteluk", bajo.includes("arteluk"));
// El 05-08 este archivo tenía el prompt de Orion.AI: si vuelve, un papá recibiría
// planes de clínicas dentales. Estas 4 líneas son el candado.
check("NO menciona Orion", !bajo.includes("orion"));
check("NO menciona clínicas dentales", !bajo.includes("clínica") && !bajo.includes("clinica"));
check("NO menciona Dentalink", !bajo.includes("dentalink"));
check("NO tiene precios en euros", !p.includes("€"));

console.log("\n— Los datos reales del taller —");
check("clase de prueba $19.990", p.includes("19.990"));
check("acuarela $45.000", p.includes("45.000"));
check("taller de artes $60.000", p.includes("60.000"));
check("premium $120.000", p.includes("120.000"));
check("matrícula $15.000", p.includes("15.000"));
check("dirección Picarte 407", p.includes("Picarte 407"));
check("días martes y jueves", bajo.includes("martes") && bajo.includes("jueves"));
check("nombra a Mary", p.includes("Mary"));
// La web dice "Oferta Mayo" en agosto: el bot no puede arrastrar una promo vencida.
check("NO ofrece la oferta de mayo", !bajo.includes("oferta mayo") && !bajo.includes("oferta de mayo"));
check("NO arrastra el precio viejo de $30.000", !p.includes("30.000"));

console.log("\n— La regla de oro: no soltar todo de una —");
check("prohíbe la lista de precios de entrada", bajo.includes("prohibido") || bajo.includes("no entregues todo"));
check("manda preguntar la edad primero", bajo.includes("edad"));
check("empuja a la clase de prueba", bajo.includes("clase de prueba"));
check("dice qué hacer con el 'lo voy a pensar'", bajo.includes("lo voy a pensar"));

console.log("\n— Que no se note, y qué hacer si preguntan —");
check("se identifica como asistente de IA si le preguntan", bajo.includes("asistente de ia"));
check("prohíbe jurar que es Mary", bajo.includes("nunca jures"));
check("un solo mensaje por respuesta", bajo.includes("un solo mensaje"));
check("sin listas ni viñetas", bajo.includes("viñeta"));

console.log("\n— Los límites: no agenda, no inventa —");
check("prohíbe agendar", bajo.includes("nunca agendes"));
check("prohíbe inventar precios y cupos", bajo.includes("nunca inventes"));
check("deriva a Mary", bajo.includes("derivarhumano"));

console.log("\n— Las herramientas que puede usar —");
const nombres = toolDefinitions.map((t) => t.function.name);
check("puede silenciar", nombres.includes("silenciar"));
check("puede derivar a Mary", nombres.includes("derivarHumano"));
check("puede marcar interés", nombres.includes("marcar_interes"));
// 'agendar' crea eventos en Google Calendar y manda emails de Orion: no puede
// estar al alcance del bot de un taller de arte, ni por error.
check("NO tiene la tool agendar (Google Meet + email de Orion)", !nombres.includes("agendar"));
check("NO tiene la tool calificar (pregunta por facturación de clínicas)", !nombres.includes("calificar"));

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
