// Ítems idénticos a los desplegables del Airtable de Arteluk.
export const INGRESO_TIPOS = [
  "Taller - plan basico",
  "Taller - plan premium",
  "Taller- por un dia",
  "Taller-vacaciones básico",
  "Taller-vacaciones premium",
  "kit de arte",
  "Arriendo espacio",
  "Sueldo",
] as const;

export const COSTO_TIPOS = [
  "Bastidores (costo variable)",
  "Pinturas (costo variable)",
  "Pinceles (costo variable)",
  "Manualidades (costo variable)",
  "yesos (costo variable)",
  "Honorarios (costo fijo)",
  "Arriendo (gasto fijo)",
  "Servicios básicos (gasto)",
  "Publicidad (gasto)",
  "convenio estacionamiento",
  "gastos",
] as const;

export function formatCLP(n: number): string {
  return "$" + Math.round(n || 0).toLocaleString("es-CL");
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
