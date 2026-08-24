// HUMO: cómo se ve el saludo REAL que Mary tiene guardado en producción, hora por hora.
// El texto viene de GET /api/config de producción (leído el 24-08-2026 13:55 Chile).
import { conSaludoDeHora } from "../src/lib/mensajes.js";

const REAL =
  "hola como esta! un gusto, mi nombre es Mary Quinteros, profesora de la academia Arteluk desde hace 5 años, cuénteme cuál es su nombre y para quién sería la clase?";

console.log("\nEl saludo que Mary tiene guardado hoy:\n  " + REAL + "\n");
for (const h of [8, 13, 21, 3]) {
  console.log(`  ${String(h).padStart(2, "0")}:00 → ${conSaludoDeHora(REAL, h)}`);
}
console.log("");
