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
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
