// System check script — does NOT import env-loader (runs standalone before any setup)
// Runs 7 non-blocking checks, exits 0 if all pass, 1 if any fail.

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const cwd = process.cwd();
let failed = false;

function ok(label: string, detail?: string) {
  console.log(`  ✓  ${label}${detail ? " — " + detail : ""}`);
}

function fail(label: string, detail?: string) {
  console.log(`  ✗  ${label}${detail ? " — " + detail : ""}`);
  failed = true;
}

function warn(label: string, detail?: string) {
  console.log(`  ⚠  ${label}${detail ? " — " + detail : ""}`);
}

console.log("\n=== whatsapp-ai-agent-kit: check-system ===\n");

// 1. Node version >= 20
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);
if (major >= 20) {
  ok("Node.js", `v${nodeVersion}`);
} else {
  fail("Node.js", `v${nodeVersion} — se requiere >= 20`);
}

// 2. OS soportado
const platform = process.platform;
if (platform === "win32" || platform === "darwin" || platform === "linux") {
  ok("Sistema operativo", platform);
} else {
  warn("Sistema operativo", `${platform} — no verificado`);
}

// 3. npm presente
try {
  const npmVersion = execSync("npm --version", { encoding: "utf-8" }).trim();
  ok("npm", `v${npmVersion}`);
} catch {
  fail("npm", "no encontrado en PATH");
}

// 4. Espacio en disco >= 500 MB
try {
  const stat = fs.statfsSync(cwd);
  const freeMB = (stat.bavail * stat.bsize) / (1024 * 1024);
  if (freeMB >= 500) {
    ok("Espacio en disco", `${Math.round(freeMB)} MB libres`);
  } else {
    fail("Espacio en disco", `solo ${Math.round(freeMB)} MB libres (se requieren >= 500 MB)`);
  }
} catch {
  warn("Espacio en disco", "no se pudo verificar");
}

// 5. Estructura del kit
const requiredFiles = [
  "package.json",
  path.join("src", "lib", "db.ts"),
  path.join("scripts", "start-bot.ts"),
];
const missingFiles = requiredFiles.filter(
  (f) => !fs.existsSync(path.join(cwd, f))
);
if (missingFiles.length === 0) {
  ok("Estructura del kit");
} else {
  fail("Estructura del kit", `faltan: ${missingFiles.join(", ")}`);
}

// 6. .env.local
const envPath = path.join(cwd, ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  if (content.includes("OPENROUTER_API_KEY=sk-or-")) {
    ok(".env.local", "OPENROUTER_API_KEY configurada");
  } else {
    warn(".env.local", "existe pero OPENROUTER_API_KEY parece vacía o inválida");
  }
} else {
  warn(".env.local", "no existe — copia .env.example a .env.local y configura la key");
}

// 7. node_modules
const nodeModulesPath = path.join(cwd, "node_modules");
if (fs.existsSync(nodeModulesPath)) {
  const hasBaileys = fs.existsSync(
    path.join(nodeModulesPath, "@whiskeysockets", "baileys")
  );
  const hasSqlite = fs.existsSync(
    path.join(nodeModulesPath, "better-sqlite3")
  );
  if (hasBaileys && hasSqlite) {
    ok("node_modules", "dependencias principales presentes");
  } else {
    warn("node_modules", "faltan dependencias clave — ejecuta npm install");
  }
} else {
  fail("node_modules", "no existe — ejecuta npm install");
}

console.log("");
if (failed) {
  console.log("Hay problemas que resolver antes de continuar.\n");
  process.exit(1);
} else {
  console.log("Todo OK. Puedes continuar con /setup o npm run wizard.\n");
  process.exit(0);
}
