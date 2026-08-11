import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "better-sqlite3",
    "pino",
    "pino-pretty",
  ],
  // La app siempre debe cargar la versión más nueva (el teléfono cacheaba versiones
  // viejas). El HTML va sin caché; los chunks de /_next/static llevan hash, así que
  // esos SÍ se pueden cachear sin riesgo de quedarse pegado.
  //
  // ⚠️ api/media queda FUERA de esta regla (11-08-2026): el "no-store" de aquí pisaba el
  // Cache-Control que la propia ruta ponía, así que las fotos de perfil y los audios se
  // volvían a descargar ENTEROS en cada apertura de la app (5,9 MB medidos). Son archivos
  // con nombre propio que no cambian; la caché la manda ahora la ruta /api/media.
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico|api/media).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
