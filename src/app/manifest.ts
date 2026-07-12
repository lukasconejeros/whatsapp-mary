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
    background_color: "#FFF4FA",
    theme_color: "#EC4899",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
