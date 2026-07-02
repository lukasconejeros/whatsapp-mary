import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" en Android/Chrome con el logo del pincel.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arteluk · Panel de Mary",
    short_name: "Arteluk",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F9",
    theme_color: "#B76E79",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
