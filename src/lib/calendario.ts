export const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

export const DIA_LABEL: Record<string, string> = {
  Lunes: "Lunes", Martes: "Martes", Miercoles: "Miércoles",
  Jueves: "Jueves", Viernes: "Viernes", Sabado: "Sábado",
};

export interface Profe { nombre: string; color: string; bg: string; bd: string }
// Profesoras activas: Mary y Paula (Lusmaría quedó fuera).
// profeColor() da un gris de respaldo para clases antiguas con otro nombre.
export const PROFES: Profe[] = [
  { nombre: "Mary",     color: "#00A884", bg: "#E7F1EC", bd: "#D3E7DE" },
  { nombre: "Paula",    color: "#8B5CF6", bg: "#F3E8FF", bd: "#E9D5FF" },
];
export const PROFE_NOMBRES = PROFES.map((p) => p.nombre);
export function profeColor(nombre: string): Profe {
  return PROFES.find((p) => p.nombre === nombre) ?? { nombre, color: "#9CA3AF", bg: "#F3F4F6", bd: "#E5E7EB" };
}

// Días de la semana en formato sin tilde, indexados por getDay() de JS (0=domingo).
// Domingo no está en DIAS (la academia trabaja Lun–Sáb) pero puede caer una fecha ahí.
export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

// Deriva el nombre del día (sin tilde, convención de DIAS) a partir de una fecha YYYY-MM-DD.
// Usa mediodía para evitar corrimientos por zona horaria.
export function diaFromFecha(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  return DIAS_SEMANA[d.getDay()];
}
