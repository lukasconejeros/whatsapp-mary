import {
  PESTANAS,
  perteneceALaPestana,
  pagoLaPrueba,
  envioPorDefecto,
  type Pestana,
} from "../src/lib/inbox-filtros.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST pestañas del inbox (solo Todos y Meta, 19-08-2026)\n");

// ── La barra: exactamente dos pestañas, en este orden ────────────────────────
check("solo hay 2 pestañas", PESTANAS.length === 2, JSON.stringify(PESTANAS));
check("la primera es Todos", PESTANAS[0]?.key === "todos" && PESTANAS[0]?.label === "Todos");
check("la segunda es Meta", PESTANAS[1]?.key === "meta" && PESTANAS[1]?.label === "Meta");
check("ya no existe la pestaña Arteluk", !PESTANAS.some(p => p.key === ("arteluk" as Pestana)));
check("ya no existe la pestaña Seguimiento", !PESTANAS.some(p => p.key === ("seguimiento" as Pestana)));

// ── Qué chat cae en qué pestaña ─────────────────────────────────────────────
const apoderado   = { categoria: "arteluk"   as const, cerrado: 0 };
const conocidoMary= { categoria: "mary"      as const, cerrado: 0 };
const leadMeta    = { categoria: "potencial" as const, cerrado: 0 };
const leadPago    = { categoria: "potencial" as const, cerrado: 1 };
const sinCategoria= { categoria: null,                 cerrado: 0 };

check("Todos muestra al apoderado (no se pierde al quitar su pestaña)", perteneceALaPestana(apoderado, "todos"));
check("Todos muestra el chat de Mary", perteneceALaPestana(conocidoMary, "todos"));
check("Todos muestra el lead de Meta", perteneceALaPestana(leadMeta, "todos"));
check("Todos muestra al que ya pagó la prueba", perteneceALaPestana(leadPago, "todos"));
check("Todos muestra el chat sin categoría", perteneceALaPestana(sinCategoria, "todos"));

check("Meta muestra el lead sin cerrar", perteneceALaPestana(leadMeta, "meta"));
check("Meta AHORA también muestra al que pagó la prueba", perteneceALaPestana(leadPago, "meta"));
check("Meta NO muestra al apoderado", !perteneceALaPestana(apoderado, "meta"));
check("Meta NO muestra el chat de Mary", !perteneceALaPestana(conocidoMary, "meta"));
check("Meta NO muestra el chat sin categoría", !perteneceALaPestana(sinCategoria, "meta"));

// ── La marca "Pagó" en la lista (ahora conviven en la misma pestaña) ─────────
check("el que pagó la prueba se marca", pagoLaPrueba(leadPago));
check("el lead sin cerrar NO se marca", !pagoLaPrueba(leadMeta));
check("el apoderado nunca se marca aunque venga cerrado", !pagoLaPrueba({ categoria: "arteluk", cerrado: 1 }));

// ── El selector de envío dentro de Meta ─────────────────────────────────────
check("marcar 'Pagó la prueba' deja el envío en seguimiento", envioPorDefecto(true) === "seguimiento");
check("devolverlo a Meta deja el envío en meta", envioPorDefecto(false) === "meta");

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
