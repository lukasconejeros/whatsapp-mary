import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" en Android/Chrome con el logo del pincel.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arteluk · Panel de Mary",
    short_name: "Arteluk",
    // Abre directo en los chats (la app de uso diario). La pantalla de vinculación de
    // WhatsApp (QR) sigue en "/" y en el menú Conexión cuando haga falta.
    start_url: "/inbox",
    display: "standalone",
    // Barra de estado / borde de la app en BLANCO (no verde), como se pidió.
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
