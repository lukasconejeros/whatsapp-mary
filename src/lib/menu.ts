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

export type NombreIcono = "chats" | "finanzas" | "calendario" | "alumnos" | "bot" | "entrenar" | "conexion" | "formularios";

export interface ItemMenu {
  href: string;
  label: string;
  icono: NombreIcono;
  /** Cómo se llama en la barra de abajo del teléfono, donde no cabe el nombre largo. */
  labelCorto?: string;
  /**
   * No sale en la barra de abajo del teléfono (lo esconde el CSS `.app-nav-<pantalla>`).
   * La marca vive acá además de en el CSS para que `npm run test:menu` sepa a cuáles NO
   * exigirles un nombre de 10 caracteres: esa regla es del ancho de la barra del teléfono,
   * y a estos no les aplica porque ahí no se ven.
   */
  soloPC?: boolean;
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
  // El CRM de alumnos va pegado al Calendario: Lukas lo pidió "en correlación" con él
  // (26-08-2026), y es donde Mary va a mirar quién viene y quién pagó.
  { href: "/alumnos",       label: "Alumnos",     icono: "alumnos"    },
  // Formularios (Lukas, 08-09-2026): se arman y se mandan desde el COMPUTADOR
  // ("que haya una parte, en mi computador, que uno pueda agregar un formulario").
  // En el teléfono se esconde con .app-nav-formularios, igual que Bot y Entrenar IA.
  { href: "/formularios",   label: "Formularios", icono: "formularios", soloPC: true },
  { href: "/ensayo",        label: "Bot",         icono: "bot"        },
  { href: "/configuracion", label: "Entrenar IA", icono: "entrenar", labelCorto: "Entrenar" },
  { href: "/conexion",      label: "Conexión",    icono: "conexion"   },
];

/** ¿Se puede llegar a esta pantalla desde el menú, o hay que escribir la dirección? */
export function tienePuerta(href: string): boolean {
  return MENU.some(i => i.href === href);
}
