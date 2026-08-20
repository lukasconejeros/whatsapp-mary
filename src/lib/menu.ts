// ── LOS BOTONES DEL MENÚ DE MARY ─────────────────────────────────────────────
//
// Vive aquí, y no dentro de AppNav.tsx, por dos razones:
//   1. se puede probar sin navegador (`npm run test:menu`), y
//   2. el 20-08-2026 se descubrió que "Entrenar IA" (/configuracion) llevaba meses
//      SIN puerta: la pantalla existía y estaba desplegada, pero ningún botón de la
//      app llevaba a ella, así que Mary solo podía llegar escribiendo la dirección.
//      Lukas: "todavía no está la pestaña a la izquierda de entrenar ia".
//
// El nombre del ícono se resuelve en AppNav; aquí no entra React para que el test
// pueda importar esta lista tal cual.

export type NombreIcono = "chats" | "finanzas" | "calendario" | "bot" | "entrenar" | "conexion";

export interface ItemMenu {
  href: string;
  label: string;
  icono: NombreIcono;
  /** Cómo se llama en la barra de abajo del teléfono, donde no cabe el nombre largo. */
  labelCorto?: string;
}

// El Asistente salió del menú (Lukas, 09-08-2026: "sácalo nomás, no lo va a ocupar
// mi mamá"). La pantalla /asistente y su API siguen vivas: volver a ponerlo es
// añadir una línea aquí.
//
// Ojo con los nombres: en el teléfono esto es la barra de abajo y se reparte el
// ancho entre todos, así que las etiquetas van cortas (11 caracteres como techo).
export const MENU: ItemMenu[] = [
  { href: "/inbox",         label: "Chats",       icono: "chats"      },
  { href: "/finanzas",      label: "Finanzas",    icono: "finanzas"   },
  { href: "/calendario",    label: "Calendario",  icono: "calendario" },
  { href: "/ensayo",        label: "Bot",         icono: "bot"        },
  { href: "/configuracion", label: "Entrenar IA", icono: "entrenar", labelCorto: "Entrenar" },
  { href: "/conexion",      label: "Conexión",    icono: "conexion"   },
];

/** ¿Se puede llegar a esta pantalla desde el menú, o hay que escribir la dirección? */
export function tienePuerta(href: string): boolean {
  return MENU.some(i => i.href === href);
}
