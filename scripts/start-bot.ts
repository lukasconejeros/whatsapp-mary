import "./env-loader.js"; // FIRST import — loads .env.local before anything else
import pino from "pino";
import { start, watchRestartFlag } from "../src/lib/baileys/client.js";

const logger = pino({ level: (process.env.LOG_LEVEL ?? "info") as pino.Level });

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  logger.error("Falta OPENROUTER_API_KEY. Edita .env.local o ejecuta /setup");
  process.exit(1);
}

process.on("SIGINT", () => {
  logger.info("Bot detenido por SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Bot detenido por SIGTERM");
  process.exit(0);
});

await start();
watchRestartFlag();
