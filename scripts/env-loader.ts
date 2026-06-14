// Side-effect only module — must be FIRST import in start-bot.ts, wizard.ts, doctor.ts
// ES module imports are hoisted; client.ts reads process.env at top-level,
// so .env.local must be loaded before any other module runs.
// Does NOT use dotenv — manual parser to avoid extra dependency.
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip wrapping single or double quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Only assign if not already set in environment
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
