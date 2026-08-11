// Los recordatorios que Mary crea en el formulario del calendario le llegan por
// WhatsApp A SU PROPIO NÚMERO (decisión de Lukas, 10-08-2026). Aquí se prueba la
// lógica pura: QUÉ toca mandar en un instante dado. Sin base ni reloj propio.
import "./env-loader.js";
import {
  recordatoriosPorMandar, HORA_SIN_HORA, GRACIA_MIN,
  type FilaRecordatorio,
} from "../src/lib/recordatorios-wa.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST recordatorios de Mary por WhatsApp\n");

const HOY = "2026-08-11";
const AYER = "2026-08-10";
const MANANA = "2026-08-12";

const fila = (over: Partial<FilaRecordatorio> = {}): FilaRecordatorio => ({
  id: 1, fecha: HOY, hora: "09:00", texto: "Pagar el arriendo del taller",
  avisar: true, enviadoAt: null, hecho: false, outboxId: null, ...over,
});

const mandar = (filas: FilaRecordatorio[], ahora: string, hoy = HOY) =>
  recordatoriosPorMandar(filas, hoy, ahora);

// ── Cuándo sale ───────────────────────────────────────────────────────────
console.log("— la hora que ella puso —");
check("a la hora justa → sale", mandar([fila()], "09:00").length === 1);
check("pasada la hora (dentro de la gracia) → sale", mandar([fila()], "10:00").length === 1);
check("antes de la hora → todavía no", mandar([fila()], "08:59").length === 0);
check("de madrugada, si ELLA puso esa hora → sale igual",
  mandar([fila({ hora: "23:30" })], "23:30").length === 1);

console.log("\n— lo viejo no se manda —");
check(`más de ${GRACIA_MIN} min tarde → no se manda (ruido)`,
  mandar([fila()], "12:30").length === 0);
check("de ayer → no se manda hoy", mandar([fila({ fecha: AYER })], "10:00").length === 0);
check("de mañana → todavía no", mandar([fila({ fecha: MANANA })], "10:00").length === 0);

console.log("\n— sin hora —");
check(`sin hora → sale a las ${HORA_SIN_HORA}:00`,
  mandar([fila({ hora: null })], `${HORA_SIN_HORA}:00`).length === 1);
check("sin hora, de madrugada → todavía no", mandar([fila({ hora: null })], "03:00").length === 0);

// ── Cuándo NO sale ────────────────────────────────────────────────────────
console.log("\n— los que no hay que mandar —");
check("sin avisar → nunca sale", mandar([fila({ avisar: false })], "09:00").length === 0);
check("ya marcado como hecho → no sale", mandar([fila({ hecho: true })], "09:00").length === 0);
check("ya enviado → no se repite", mandar([fila({ enviadoAt: 1_760_000_000 })], "09:00").length === 0);
check("ya encolado (esperando al outbox) → no se encola dos veces",
  mandar([fila({ outboxId: 42 })], "09:00").length === 0);

// ── El mensaje ────────────────────────────────────────────────────────────
console.log("\n— el mensaje —");
const uno = mandar([fila()], "09:00")[0];
check("lleva el id del recordatorio", uno?.id === 1, JSON.stringify(uno));
check("dice el texto que ella escribió",
  uno?.mensaje.includes("Pagar el arriendo del taller") === true, uno?.mensaje);
check("se nota que es un recordatorio",
  /recordatorio/i.test(uno?.mensaje ?? ""), uno?.mensaje);

console.log("\n— varios a la vez —");
const varios = mandar(
  [fila({ id: 1, hora: "09:00" }), fila({ id: 2, hora: "08:00", texto: "Llamar a la profe" }),
   fila({ id: 3, hora: "18:00", texto: "Comprar arcilla" })],
  "09:30"
);
check("salen los 2 que ya tocan, no el de las 18:00", varios.length === 2, JSON.stringify(varios));
check("el más temprano va primero", varios[0]?.id === 2, JSON.stringify(varios.map((v) => v.id)));

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pasadas, ${fail} fallidas\n`);
process.exit(fail === 0 ? 0 : 1);
