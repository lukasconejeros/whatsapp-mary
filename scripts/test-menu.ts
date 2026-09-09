import { readFileSync, existsSync } from "node:fs";
import { MENU, tienePuerta, type ItemMenu } from "../src/lib/menu.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST el menú de Mary — la puerta a Entrenar IA (20-08-2026)\n");

const hrefs = MENU.map((i: ItemMenu) => i.href);

// ── Lo que pidió Lukas: que Entrenar IA aparezca en el menú de la izquierda ───
check("Entrenar IA está en el menú", hrefs.includes("/configuracion"), hrefs.join(","));
const entrenar = MENU.find(i => i.href === "/configuracion");
check("se llama 'Entrenar IA'", entrenar?.label === "Entrenar IA", String(entrenar?.label));
check("va justo después de Bot", hrefs.indexOf("/configuracion") === hrefs.indexOf("/ensayo") + 1, hrefs.join(","));

// ── Alumnos: el CRM que pidió Lukas el 26-08-2026 ────────────────────────────
// "un CRM aparte, pestaña propia a la izquierda, una tarjeta por alumno (…) en
// correlación con el calendario" ⇒ va pegado al Calendario, no al final.
check("Alumnos está en el menú", hrefs.includes("/alumnos"), hrefs.join(","));
const alumnos = MENU.find(i => i.href === "/alumnos");
check("se llama 'Alumnos'", alumnos?.label === "Alumnos", String(alumnos?.label));
check("va justo después de Calendario", hrefs.indexOf("/alumnos") === hrefs.indexOf("/calendario") + 1, hrefs.join(","));

// ── La familia completa: ningún botón de antes se pierde ni cambia de orden ───
const deAntes = ["/inbox", "/finanzas", "/calendario", "/ensayo", "/conexion"];
for (const h of deAntes) check(`sigue estando ${h}`, hrefs.includes(h));
check("el orden de los de antes no cambió", JSON.stringify(hrefs.filter(h => deAntes.includes(h))) === JSON.stringify(deAntes), hrefs.join(","));
check("Conexión sigue siendo el último", hrefs[hrefs.length - 1] === "/conexion", hrefs.join(","));
// 8 desde el 08-09-2026: entró "Formularios". En el teléfono se esconde por CSS
// (.app-nav-formularios), igual que Bot, Entrenar IA y Conexión.
check("son 8 botones, sin repetidos", MENU.length === 8 && new Set(hrefs).size === 8, String(MENU.length));
check("Formularios tiene su botón", hrefs.includes("/formularios"), hrefs.join(","));

// ── Que quepan en la barra de abajo del teléfono ──────────────────────────────
for (const i of MENU) check(`'${i.label}' es corto para la barra del teléfono`, i.label.length <= 11, String(i.label.length));
check("Entrenar IA tiene etiqueta corta para el teléfono", entrenar?.labelCorto === "Entrenar", String(entrenar?.labelCorto));
// Los marcados `soloPC` no entran: no se ven en la barra del teléfono, así que el
// techo de 10 caracteres (que es del ancho de esa barra) no les aplica.
for (const i of MENU.filter(m => !m.soloPC)) check(`la etiqueta del teléfono de '${i.label}' cabe en una línea`, (i.labelCorto ?? i.label).length <= 10, String(i.labelCorto ?? i.label));
check("Formularios está marcado como solo del computador", MENU.find(m => m.href === "/formularios")?.soloPC === true);
for (const i of MENU) check(`'${i.label}' tiene ícono`, typeof i.icono === "string" && i.icono.length > 0);

// ── Que cada botón lleve a una pantalla que existe de verdad ─────────────────
for (const i of MENU) {
  const p = `src/app${i.href}/page.tsx`;
  check(`la pantalla de '${i.label}' existe (${p})`, existsSync(p));
}

// ── Que el menú de la pantalla salga de aquí y no de una lista copiada ───────
const nav = readFileSync("src/components/AppNav.tsx", "utf8");
check("AppNav usa la lista de menu.ts", nav.includes("from '@/lib/menu'") || nav.includes('from "@/lib/menu"'), "no importa menu.ts");
check("AppNav ya no lleva su propia lista de hrefs", !/href:\s*'\/inbox'/.test(nav), "sigue la lista vieja dentro del componente");

// ── El helper que dice si una pantalla tiene puerta en el menú ───────────────
check("tienePuerta('/configuracion') = true", tienePuerta("/configuracion") === true);
check("tienePuerta('/inbox') = true", tienePuerta("/inbox") === true);
check("una pantalla suelta no tiene puerta", tienePuerta("/ensayo/audios") === false);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} bien, ${fail} mal\n`);
process.exit(fail === 0 ? 0 : 1);
