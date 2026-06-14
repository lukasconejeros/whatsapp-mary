import "./env-loader.js"; // Load .env.local first

import fs from "fs";
import path from "path";
import chalk from "chalk";
import { execSync } from "child_process";

const cwd = process.cwd();
const DATA_DIR = path.join(cwd, "data");
const DB_PATH = path.join(DATA_DIR, "messages.db");
const AUTH_DIR = path.join(cwd, "auth");

console.log(chalk.bold("\n=== whatsapp-ai-agent-kit: doctor ===\n"));

// ── Bloque 1: .env.local y API Key ──────────────────────────────────────────
console.log(chalk.cyan("1. Variables de entorno"));

const envPath = path.join(cwd, ".env.local");
if (!fs.existsSync(envPath)) {
  console.log(chalk.red("  ✗ .env.local no existe"));
  console.log(chalk.gray("    → Copia .env.example a .env.local y configura OPENROUTER_API_KEY"));
} else {
  console.log(chalk.green("  ✓ .env.local encontrado"));
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey || !apiKey.trim()) {
  console.log(chalk.red("  ✗ OPENROUTER_API_KEY vacía o no definida"));
  console.log(chalk.gray("    → Obtén tu key en https://openrouter.ai/keys"));
} else if (!apiKey.startsWith("sk-or-")) {
  console.log(chalk.yellow("  ⚠ OPENROUTER_API_KEY no tiene formato sk-or-... — verifica que sea de OpenRouter"));
} else {
  console.log(chalk.green("  ✓ OPENROUTER_API_KEY configurada"));
}

const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
if (model.endsWith(":free")) {
  console.log(chalk.red(`  ✗ OPENROUTER_MODEL="${model}" — los modelos :free se saturan en producción. Usa gpt-4o-mini u otro de pago.`));
} else {
  console.log(chalk.green(`  ✓ OPENROUTER_MODEL="${model}"`));
}

// ── Bloque 2: node_modules y TypeScript ─────────────────────────────────────
console.log(chalk.cyan("\n2. Dependencias y TypeScript"));

const nodeModulesPath = path.join(cwd, "node_modules");
if (!fs.existsSync(nodeModulesPath)) {
  console.log(chalk.red("  ✗ node_modules no existe — ejecuta: npm install"));
} else {
  console.log(chalk.green("  ✓ node_modules existe"));

  const hasBaileys = fs.existsSync(path.join(nodeModulesPath, "@whiskeysockets", "baileys"));
  const hasSqlite = fs.existsSync(path.join(nodeModulesPath, "better-sqlite3"));
  if (!hasBaileys) console.log(chalk.red("  ✗ @whiskeysockets/baileys no instalado"));
  if (!hasSqlite) console.log(chalk.red("  ✗ better-sqlite3 no instalado"));
  if (hasBaileys && hasSqlite) console.log(chalk.green("  ✓ Dependencias clave presentes"));

  try {
    execSync("npx tsc --noEmit", { cwd, stdio: "pipe" });
    console.log(chalk.green("  ✓ TypeScript sin errores"));
  } catch (e) {
    console.log(chalk.red("  ✗ TypeScript tiene errores:"));
    const output = (e as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ?? "";
    output.split("\n").slice(0, 10).forEach((line) => console.log(chalk.gray("    " + line)));
  }
}

// ── Bloque 3: Estado de conexión ────────────────────────────────────────────
console.log(chalk.cyan("\n3. Estado de WhatsApp"));

if (!fs.existsSync(DB_PATH)) {
  console.log(chalk.yellow("  ⚠ Base de datos no existe — el bot aún no se ha arrancado nunca"));
} else {
  try {
    // Use require for readonly access to avoid lazy-init touching real DB
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(DB_PATH, { readonly: true });
    const row = db
      .prepare("SELECT status, phone, qr_string FROM connection_state WHERE id = 1")
      .get() as { status: string; phone: string | null; qr_string: string | null } | undefined;
    db.close();

    if (!row) {
      console.log(chalk.yellow("  ⚠ Tabla connection_state vacía"));
    } else {
      const statusMsg: Record<string, string> = {
        connected: chalk.green(`  ✓ Conectado como +${row.phone ?? "?"}`),
        qr: chalk.yellow("  ⚠ Esperando escaneo de QR — abre http://localhost:3000"),
        connecting: chalk.yellow("  ⚠ Conectando... espera unos segundos"),
        disconnected: chalk.red("  ✗ Desconectado — inicia el bot con npm run start:all"),
      };
      console.log(statusMsg[row.status] ?? chalk.gray(`  ? Estado desconocido: ${row.status}`));
    }
  } catch (e) {
    console.log(chalk.red("  ✗ No se pudo leer la DB: " + String(e)));
  }
}

// ── Bloque 4: Archivos clave ─────────────────────────────────────────────────
console.log(chalk.cyan("\n4. Archivos de configuración"));

if (fs.existsSync(AUTH_DIR)) {
  const files = fs.readdirSync(AUTH_DIR);
  console.log(chalk.green(`  ✓ auth/ existe (${files.length} archivos)`));
} else {
  console.log(chalk.yellow("  ⚠ auth/ no existe — se crea al conectar WhatsApp por primera vez"));
}

const negocioPath = path.join(cwd, "prompts", "negocio.md");
if (fs.existsSync(negocioPath)) {
  const content = fs.readFileSync(negocioPath, "utf-8");
  const sections = ["## Nombre", "## A qué se dedica", "## Propuesta de valor", "## Preguntas", "## Criterios", "## Acción"];
  const missingSections = sections.filter((s) => !content.includes(s));
  if (missingSections.length === 0) {
    console.log(chalk.green("  ✓ prompts/negocio.md configurado con todas las secciones"));
  } else {
    console.log(chalk.yellow(`  ⚠ prompts/negocio.md existe pero le faltan secciones: ${missingSections.join(", ")}`));
    console.log(chalk.gray("    → Ejecuta /personaliza para reconfigurarlo"));
  }
} else {
  console.log(chalk.yellow("  ⚠ prompts/negocio.md no existe — el bot usa prompt genérico"));
  console.log(chalk.gray("    → Ejecuta /personaliza para personalizar el agente"));
}

// ── Bloque 5: Procesos zombie (Windows) ─────────────────────────────────────
if (process.platform === "win32") {
  console.log(chalk.cyan("\n5. Procesos node (Windows)"));
  try {
    const output = execSync("tasklist /FI \"IMAGENAME eq node.exe\" /NH", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const nodeProcesses = output
      .split("\n")
      .filter((line) => line.toLowerCase().includes("node.exe"));
    const count = nodeProcesses.length;
    if (count > 3) {
      console.log(chalk.yellow(`  ⚠ ${count} procesos node.exe activos — pueden ser instancias zombie`));
      console.log(chalk.gray("    → Cierra la terminal y vuelve a abrir, o usa el Administrador de tareas"));
    } else {
      console.log(chalk.green(`  ✓ ${count} proceso(s) node.exe`));
    }
  } catch {
    console.log(chalk.gray("  - No se pudo verificar procesos node.exe"));
  }
}

console.log(chalk.bold("\n=== Diagnóstico completo ===\n"));
