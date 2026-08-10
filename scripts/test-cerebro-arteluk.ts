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
check("dirección Picarte 805 (Mary la corrigió el 10-08)", p.includes("Picarte 805"));
check("YA NO dice Picarte 407 (dato viejo, equivocado)", !p.includes("Picarte 407"));
check("nombra a Mary", p.includes("Mary"));

// El 10-08 Mary entrenó al bot en /ensayo y corrigió 22 respuestas. Estos checks son
// el candado de lo que ella dijo con sus palabras: si alguien vuelve a poner los datos
// viejos, un apoderado recibe información falsa.
console.log("\n— Lo que Mary corrigió entrenando (10-08-2026) —");
check("desde los 5 años, no desde los 7", bajo.includes("desde los 5 años") && bajo.includes('nunca digas que es "desde los 7"'));
check("SÍ hacen arteterapia (el bot decía que no)", bajo.includes("arteterapia") && bajo.includes("diplomado en arteterapia"));
check("la clase de prueba sirve para ver nivel y personalidad", bajo.includes("personalidad"));
check("se puede recuperar una clase dentro del mes", bajo.includes("recuperar una clase"));
check("cuenta la Metodología Arteluk y la rosa cromática", bajo.includes("rosa cromática"));
check("monocromáticas para niños impulsivos / TDAH", bajo.includes("monocromáticas"));
check("sala de espera con café y té", bajo.includes("salita de espera"));
check("no hay becas", bajo.includes("no contamos con becas"));
check("pagos mensuales, primeros 10 días, solo transferencia", bajo.includes("primeros 10 días") && bajo.includes("transferencia"));
check("datos para transferir (Grupo Arteluk SpA)", p.includes("GRUPO ARTELUK SPA") && p.includes("1098729145"));
check("se presenta como Mary Quinteros", bajo.includes("magíster en psicología"));
check("prohíbe el voseo argentino ('querés')", bajo.includes("sin voseo"));

console.log("\n— Los horarios que confirmó Mary el 10-08 —");
// Antes había 3 versiones distintas de los días. Esta es la que confirmó ella, y el bot
// no puede dar ninguna otra: un horario inventado hace que un apoderado llegue a la puerta
// cerrada.
check("hay talleres todos los días", bajo.includes("todos los días"));
check("lunes 16:00 a 17:00 y 17:30 a 19:30", /lunes: 16:00 a 17:00 y 17:30 a 19:30/i.test(p));
check("martes 17:30 a 19:30", /martes: 17:30 a 19:30/i.test(p));
check("miércoles 17:30 a 19:30", /miércoles: 17:30 a 19:30/i.test(p));
check("jueves 16:00 a 17:00 y 17:30 a 19:30", /jueves: 16:00 a 17:00 y 17:30 a 19:30/i.test(p));
check("viernes 17:30 a 19:30 (adolescentes)", /viernes: 17:30 a 19:30 \(grupo de adolescentes\)/i.test(p));
check("sábado 11:00 a 13:00 (adolescentes)", /sábado: 11:00 a 13:00 \(grupo de adolescentes\)/i.test(p));
check("grupos de máximo 6 alumnos", bajo.includes("máximo 6 alumnos"));
check("primero la edad, después los horarios", bajo.includes("nunca antes de saber la edad"));
check("el cupo lo confirma Mary, no el bot", bajo.includes("ni digas que hay cupo"));
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
