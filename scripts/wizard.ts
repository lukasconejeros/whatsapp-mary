import "./env-loader.js";

import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import chalk from "chalk";
import boxen from "boxen";
import Enquirer from "enquirer";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env.local");
const envExamplePath = path.join(cwd, ".env.example");

console.log(
  boxen(
    chalk.bold("WhatsApp AI Agent Kit") +
      "\n" +
      chalk.gray("Asistente de configuración (fallback sin Claude Code)"),
    {
      padding: 1,
      borderStyle: "round",
      borderColor: "green",
    }
  )
);

// ── Fase A: Validación silenciosa ────────────────────────────────────────────
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);
if (major < 20) {
  console.log(chalk.red(`✗ Node.js v${nodeVersion} — se requiere >= 20`));
  process.exit(1);
}
console.log(chalk.green(`✓ Node.js v${nodeVersion}`));
console.log(chalk.green(`✓ SO: ${process.platform}`));

// ── Fase B: Instalación de dependencias ─────────────────────────────────────
const nodeModulesPath = path.join(cwd, "node_modules");
if (!fs.existsSync(nodeModulesPath)) {
  console.log(chalk.cyan("\nInstalando dependencias (npm install)..."));
  try {
    execSync("npm install", { cwd, stdio: "inherit" });
    console.log(chalk.green("✓ Dependencias instaladas"));
  } catch {
    console.log(chalk.red("✗ npm install falló. Si ves ERR_INVALID_ARG_TYPE, borra node_modules e intenta de nuevo."));
    process.exit(1);
  }
} else {
  console.log(chalk.green("✓ node_modules existe"));
}

// ── Fase C: Configurar API Key de OpenRouter ──────────────────────────────────
console.log(chalk.cyan("\nConfiguración de OpenRouter\n"));

// Copy .env.example to .env.local if it doesn't exist
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log(chalk.gray("  → .env.local creado desde .env.example"));
}

const existingEnv = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf-8")
  : "";
const existingKey =
  existingEnv.match(/^OPENROUTER_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";

if (existingKey && existingKey.startsWith("sk-or-")) {
  console.log(chalk.green(`✓ OPENROUTER_API_KEY ya configurada`));
} else {
  const { apiKey } = (await new Enquirer().prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Pega tu API Key de OpenRouter (sk-or-v1-...)",
      validate: (value: string) =>
        value.startsWith("sk-or-")
          ? true
          : "La key debe empezar con sk-or-",
    },
  ])) as { apiKey: string };

  // Write or replace the key in .env.local
  let content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf-8")
    : "";
  const keyPattern = new RegExp("^OPENROUTER_API_KEY=.*$", "m");
  if (keyPattern.test(content)) {
    content = content.replace(keyPattern, `OPENROUTER_API_KEY=${apiKey}`);
  } else {
    content += `\nOPENROUTER_API_KEY=${apiKey}\n`;
  }
  fs.writeFileSync(envPath, content, "utf-8");
  process.env.OPENROUTER_API_KEY = apiKey;
  console.log(chalk.green("✓ API Key guardada en .env.local"));
}

// ── Fase D: Arrancar el bot ──────────────────────────────────────────────────
console.log(chalk.cyan("\nArrancando el agente...\n"));
console.log(chalk.gray("Abre http://localhost:3000 en tu navegador para escanear el QR.\n"));
console.log(chalk.yellow("Ctrl+C para detener.\n"));

const isWin = process.platform === "win32";
const child = spawn(isWin ? "npm.cmd" : "npm", ["run", "start:all"], {
  cwd,
  stdio: "inherit",
  shell: isWin,
});

child.on("error", (err) => {
  console.error(chalk.red("Error al arrancar: " + err.message));
  process.exit(1);
});
