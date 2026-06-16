export const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

export const DIA_LABEL: Record<string, string> = {
  Lunes: "Lunes", Martes: "Martes", Miercoles: "Miércoles",
  Jueves: "Jueves", Viernes: "Viernes", Sabado: "Sábado",
};

export interface Profe { nombre: string; color: string; bg: string; bd: string }
export const PROFES: Profe[] = [
  { nombre: "Mary",     color: "#EC4899", bg: "#FCE7F3", bd: "#FBCFE8" },
  { nombre: "Paula",    color: "#8B5CF6", bg: "#F3E8FF", bd: "#E9D5FF" },
  { nombre: "Lusmaría", color: "#F59E0B", bg: "#FEF3C7", bd: "#FDE68A" },
];
export const PROFE_NOMBRES = PROFES.map((p) => p.nombre);
export function profeColor(nombre: string): Profe {
  return PROFES.find((p) => p.nombre === nombre) ?? { nombre, color: "#9CA3AF", bg: "#F3F4F6", bd: "#E5E7EB" };
}
