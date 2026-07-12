import { importarIngresoCartola, importarCostoCartola } from "./db";

// Parser de cartola de MercadoPago. Toma el texto (pegado o exportado) y clasifica
// cada movimiento en INGRESO (abonos: transferencias recibidas / liberaciones),
// COSTO (cargos tipo "Pago") u OMITIDO (transferencias enviadas = retiros al banco).
// Deduplica por el ID de transacción (mp_id) al importar.

export type Clasificacion = "ingreso" | "costo" | "omitido";

export interface MovimientoCartola {
  mpId: string;
  fecha: string;      // YYYY-MM-DD
  monto: number;      // valor absoluto en CLP (entero)
  comision: number;   // comisión de MercadoPago (otros conceptos), 0 si no hay
  movimiento: string; // Abono | Cargo
  tipoTrans: string;  // Transferencia recibida | Pago | Transferencia enviada | ...
  clasificacion: Clasificacion;
}

export interface ResultadoParse {
  movimientos: MovimientoCartola[];
  totalIngresos: number;
  totalCostos: number;
  omitidos: number;
}

// "19.990,00" → 19990 ; "-620.000,00" → -620000
function parseMonto(s: string): number {
  const limpio = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function detectarTipoTrans(linea: string): string {
  const l = linea.toLowerCase();
  if (l.includes("transferencia recibida")) return "Transferencia recibida";
  if (l.includes("transferencia enviada")) return "Transferencia enviada";
  if (l.includes("liberaci")) return "Liberación de dinero";
  if (l.includes("pago")) return "Pago";
  return "Otro";
}

export function parsearCartola(texto: string): ResultadoParse {
  const movimientos: MovimientoCartola[] = [];
  const vistos = new Set<string>();
  const amountRe = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

  for (const linea of texto.split(/\r?\n/)) {
    // Fecha dd-mm-yyyy
    const fm = linea.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (!fm) continue;
    // Movimiento
    const esAbono = /\bAbono\b/i.test(linea);
    const esCargo = /\bCargo\b/i.test(linea);
    if (!esAbono && !esCargo) continue;
    // ID de transacción: la única corrida larga de dígitos (los montos llevan . y ,)
    const idm = linea.match(/\b(\d{9,15})\b/);
    if (!idm) continue;
    const mpId = idm[1];
    if (vistos.has(mpId)) continue;

    // Monto de transacción: el primer monto (formato chileno) DESPUÉS del ID.
    const idPos = linea.indexOf(mpId) + mpId.length;
    const resto = linea.slice(idPos);
    const montos = resto.match(amountRe);
    if (!montos || montos.length === 0) continue;
    const monto = parseMonto(montos[0]);
    if (!Number.isFinite(monto)) continue;
    // Segundo monto = "otros conceptos" (comisión de MercadoPago, viene negativo).
    const otros = montos.length > 1 ? parseMonto(montos[1]) : 0;
    const comision = Number.isFinite(otros) && otros < 0 ? Math.abs(otros) : 0;

    const fecha = `${fm[3]}-${fm[2]}-${fm[1]}`;
    const tipoTrans = detectarTipoTrans(linea);
    const movimiento = esAbono ? "Abono" : "Cargo";

    let clasificacion: Clasificacion;
    if (esAbono) clasificacion = "ingreso";
    else if (tipoTrans === "Transferencia enviada") clasificacion = "omitido"; // retiro al banco
    else clasificacion = "costo";

    vistos.add(mpId);
    movimientos.push({ mpId, fecha, monto: Math.abs(monto), comision, movimiento, tipoTrans, clasificacion });
  }

  const totalIngresos = movimientos.filter((m) => m.clasificacion === "ingreso").reduce((s, m) => s + m.monto, 0);
  const totalCostos = movimientos.filter((m) => m.clasificacion === "costo").reduce((s, m) => s + m.monto, 0);
  const omitidos = movimientos.filter((m) => m.clasificacion === "omitido").length;
  return { movimientos, totalIngresos, totalCostos, omitidos };
}

export interface ResultadoImport {
  ingresosNuevos: number;
  costosNuevos: number;
  comisiones: number;
  duplicados: number;
  omitidos: number;
  totalIngresos: number;
  totalCostos: number;
}

// Parsea e IMPORTA a la base (dedup por mp_id). Los ingresos se agrupan por su tipo
// de transacción (Transferencia recibida / Liberación de dinero); los pagos como
// "Pago"; y la comisión de MercadoPago de cada liberación se agrega como gasto aparte.
export function importarCartola(texto: string): ResultadoImport {
  const r = parsearCartola(texto);
  let ingresosNuevos = 0, costosNuevos = 0, comisiones = 0, duplicados = 0;
  for (const m of r.movimientos) {
    if (m.clasificacion === "omitido") continue;
    if (m.clasificacion === "ingreso") {
      if (importarIngresoCartola({ fecha: m.fecha, monto: m.monto, tipo: m.tipoTrans, detalle: "MercadoPago", mpId: m.mpId })) ingresosNuevos++;
      else duplicados++;
    } else {
      if (importarCostoCartola({ fecha: m.fecha, valor: m.monto, tipo: "Pago", notas: "MercadoPago", mpId: m.mpId })) costosNuevos++;
      else duplicados++;
    }
    if (m.comision > 0) {
      if (importarCostoCartola({ fecha: m.fecha, valor: m.comision, tipo: "Comisión MercadoPago", notas: "Comisión MercadoPago", mpId: `${m.mpId}-com` })) comisiones++;
      else duplicados++;
    }
  }
  return { ingresosNuevos, costosNuevos, comisiones, duplicados, omitidos: r.omitidos, totalIngresos: r.totalIngresos, totalCostos: r.totalCostos };
}
