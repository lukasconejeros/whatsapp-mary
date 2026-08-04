import "./env-loader.js";
import {
  recordatoriosPendientes, minutosDe, minutosHasta, enSilencio,
  type FilaCalendario,
} from "../src/lib/recordatorios.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name} ${extra}`); fail++; }
}

console.log("\n🧪 TEST recordatorios del calendario de Arteluk\n");

// 2026-08-04 = martes · 2026-08-05 = miércoles
const HOY = "2026-08-04";
const MANANA = "2026-08-05";

const fila = (over: Partial<FilaCalendario> = {}): FilaCalendario => ({
  id: 1, fecha: HOY, hora: "18:00", profe: "Mary",
  alumnos: ["Ana", "Sofía"], nota: null, aviso_5h: 0, ...over,
});

// resumen = qué se envió ya (clave = fecha del día resumido)
const rec = (
  filas: FilaCalendario[], ahora: string, resumenEnviado: string[] = [], hoy = HOY
) => recordatoriosPendientes(filas, hoy, ahora, new Set(resumenEnviado));

// ── minutosDe ─────────────────────────────────────────────────────────────
console.log("— minutosDe —");
check("minutosDe 00:00 = 0", minutosDe("00:00") === 0);
check("minutosDe 18:00 = 1080", minutosDe("18:00") === 1080, String(minutosDe("18:00")));
check("minutosDe null = null", minutosDe(null) === null);
check("minutosDe basura = null", minutosDe("tarde") === null);
check("minutosDe hora imposible = null", minutosDe("24:99") === null);

// ── Silencio ──────────────────────────────────────────────────────────────
console.log("\n— silencio nocturno —");
check("silencio de madrugada", enSilencio(3) && enSilencio(23) && enSilencio(0));
check("07:00 ya no es silencio", !enSilencio(7) && !enSilencio(15));
check("de madrugada no manda nada", rec([fila({ hora: "05:00" })], "03:00").length === 0);

// ── Aviso de 5 h antes de cada clase ──────────────────────────────────────
console.log("\n— aviso 5 h antes —");
check("faltan 4 h → avisa", rec([fila()], "14:00")[0]?.clase === "5h", JSON.stringify(rec([fila()], "14:00")[0]));
check("faltan 5 h justas → avisa", rec([fila()], "13:00")[0]?.clase === "5h");
check("faltan 6 h → todavía no", rec([fila()], "12:00").length === 0);
check("dice la hora de la clase",
  rec([fila()], "14:00")[0]?.titulo.includes("18:00") === true, rec([fila()], "14:00")[0]?.titulo);
check("nombra a los alumnos",
  rec([fila()], "14:00")[0]?.cuerpo.includes("Ana") === true, rec([fila()], "14:00")[0]?.cuerpo);
check("ya avisada → nada", rec([fila({ aviso_5h: 1 })], "14:00").length === 0);
check("clase que ya empezó → nada (no se avisa tarde)", rec([fila()], "19:00").length === 0);
check("clase de mañana → todavía nada", rec([fila({ fecha: MANANA })], "14:00").length === 0);
check("fila sin hora → no entra en el aviso de 5 h", rec([fila({ hora: null })], "14:00").length === 0);

// Varias clases a la MISMA hora = un solo aviso (si no, 4 alumnos = 4 pushes).
const mismaHora = rec([fila({ id: 1 }), fila({ id: 2, profe: "Paula", alumnos: ["Ema"] })], "14:00");
check("dos clases a la misma hora → UN solo aviso", mismaHora.length === 1, String(mismaHora.length));
check("el aviso agrupado marca las dos filas",
  mismaHora[0]?.filas.length === 2, JSON.stringify(mismaHora[0]?.filas));
check("el aviso agrupado nombra a las dos profes",
  mismaHora[0]?.cuerpo.includes("Mary") === true && mismaHora[0]?.cuerpo.includes("Paula") === true,
  mismaHora[0]?.cuerpo);

const dosHoras = rec([fila({ id: 1, hora: "16:00" }), fila({ id: 2, hora: "18:00" })], "14:00");
check("dos horas distintas → dos avisos", dosHoras.length === 2, String(dosHoras.length));

// ── Resumen de la víspera ─────────────────────────────────────────────────
console.log("\n— resumen de la víspera —");
const conManana = [fila({ id: 9, fecha: MANANA, hora: "16:00" }), fila({ id: 10, fecha: MANANA, hora: "18:00", profe: "Paula" })];
check("a las 20:00 sale el resumen de mañana",
  rec(conManana, "20:00")[0]?.clase === "resumen", JSON.stringify(rec(conManana, "20:00")[0]));
check("a las 19:00 todavía no", rec(conManana, "19:00").length === 0);
check("el resumen dice cuántas son",
  rec(conManana, "20:00")[0]?.titulo.includes("2") === true, rec(conManana, "20:00")[0]?.titulo);
check("el resumen lista las horas",
  rec(conManana, "20:00")[0]?.cuerpo.includes("16:00") === true &&
  rec(conManana, "20:00")[0]?.cuerpo.includes("18:00") === true, rec(conManana, "20:00")[0]?.cuerpo);
check("resumen ya enviado → no se repite", rec(conManana, "20:00", [MANANA]).length === 0);
check("sin nada mañana → no manda resumen vacío", rec([fila()], "20:00").length === 0);
check("el resumen apunta al día siguiente",
  rec(conManana, "20:00")[0]?.fechaResumen === MANANA);

// Anotación libre de Mary (sin alumnos): el calendario no es solo clases.
const anotacion = fila({ id: 3, hora: "15:00", alumnos: [], nota: "Ir al banco" });
check("una anotación sin alumnos también avisa",
  rec([anotacion], "11:00")[0]?.cuerpo.includes("Ir al banco") === true,
  rec([anotacion], "11:00")[0]?.cuerpo);
check("la anotación entra en el resumen de la víspera",
  rec([fila({ id: 3, fecha: MANANA, hora: "15:00", alumnos: [], nota: "Ir al banco" })], "20:00")[0]
    ?.cuerpo.includes("Ir al banco") === true);

// ── minutosHasta ──────────────────────────────────────────────────────────
console.log("\n— minutosHasta —");
check("minutosHasta cruza el día",
  minutosHasta(fila({ fecha: MANANA, hora: "09:00" }), HOY, "21:00") === 720,
  String(minutosHasta(fila({ fecha: MANANA, hora: "09:00" }), HOY, "21:00")));
check("minutosHasta sin hora = null", minutosHasta(fila({ hora: null }), HOY, "10:00") === null);
check("minutosHasta negativo si ya pasó",
  (minutosHasta(fila({ hora: "08:00" }), HOY, "10:00") ?? 0) === -120);

console.log(`\nResultado: ${pass} ✅   ${fail} ❌`);
process.exit(fail > 0 ? 1 : 0);
