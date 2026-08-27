// ── EL BOTÓN DE CONEXIÓN NO SE VE EN EL TELÉFONO (Lukas, 27-08-2026) ──────────
//
// Textual: "que en el telefono no aparezca lo del qr eso solo nos sirve para el
// computador". El QR se escanea desde el computador de Lukas; a Mary, en su
// teléfono, ese botón solo le estorba y la puede llevar a una pantalla que no
// entiende.
//
// Lo que se comprueba aquí:
//   1. la pantalla /conexion SIGUE VIVA (él la usa, solo se esconde el botón),
//   2. en el computador el botón sigue estando donde siempre,
//   3. en el teléfono el botón y su puntito naranja se esconden por CSS,
//   4. y NINGÚN otro botón del menú se esconde de rebote (la familia completa).

import { readFileSync, existsSync } from "node:fs";
import { MENU, type ItemMenu } from "../src/lib/menu.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean, e = "") { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n} ${e}`); fail++; } }

console.log("\n🧪 TEST el QR no aparece en el teléfono de Mary (27-08-2026)\n");

const css = readFileSync("src/app/globals.css", "utf8");
const nav = readFileSync("src/components/AppNav.tsx", "utf8");
const hrefs = MENU.map((i: ItemMenu) => i.href);

// ── 1. La pantalla sigue viva: se esconde el botón, no se borra nada ─────────
check("la pantalla /conexion sigue existiendo", existsSync("src/app/conexion/page.tsx"));
check("Conexión sigue en la lista del menú (el computador la necesita)", hrefs.includes("/conexion"), hrefs.join(","));
check("siguen siendo 7 botones", MENU.length === 7, String(MENU.length));

// ── 2. El botón lleva una marca propia para poder esconderlo solo a él ───────
check("el enlace de Conexión lleva la clase app-nav-conexion", /app-nav-conexion/.test(nav), "AppNav no marca el botón de Conexión");

// ── 3. En el teléfono se esconde ─────────────────────────────────────────────
const bloqueMovil = css.split("@media (max-width: 767px)").slice(1).join("\n");
check("hay una regla que esconde app-nav-conexion en el teléfono",
  /\.app-nav-conexion[^{]*\{[^}]*display:\s*none/.test(bloqueMovil),
  "no se esconde dentro de @media (max-width: 767px)");

// ── 4. La familia completa: los otros 6 botones NO se esconden ───────────────
// Esto es lo que evita el error de siempre (apagar uno y llevarse a los hermanos).
for (const i of MENU) {
  if (i.href === "/conexion") continue;
  const slug = i.href.slice(1);
  const escondido = new RegExp(`\.app-nav-${slug}[^{]*\{[^}]*display:\s*none`).test(bloqueMovil);
  check(`'${i.label}' SIGUE viéndose en el teléfono`, !escondido, `se esconde app-nav-${slug}`);
}

// ── 5. En el computador no cambia nada ───────────────────────────────────────
const antesDelMovil = css.split("@media (max-width: 767px)")[0];
check("en el computador el botón de Conexión NO se esconde",
  !/\.app-nav-conexion[^{]*\{[^}]*display:\s*none/.test(antesDelMovil),
  "se esconde también en el computador");

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} bien, ${fail} mal\n`);
process.exit(fail === 0 ? 0 : 1);
