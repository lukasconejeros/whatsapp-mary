import { getToken, disponibilidadDiaria, PROFESIONALES_MONACO } from "../src/lib/dentalsoft.js";

async function main() {
  console.log("🧪 TEST cliente Dentalsoft (Clínica Mónaco)\n");

  // 1. Auth
  const token = await getToken();
  console.log(`✅ Token OAuth obtenido (${token.slice(0, 18)}…)`);

  // 2. Disponibilidad diaria de un profesional para los próximos días
  const idProf = 19554769; // Carolina Delgado Vargas
  console.log(`\nBuscando disponibilidad de ${PROFESIONALES_MONACO[idProf]}…`);

  // próximo lunes-sábado dentro de 7 días
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 864e5);
    const fecha = d.toISOString().slice(0, 10);
    try {
      const slots = await disponibilidadDiaria(idProf, fecha, 6);
      const arr = Array.isArray(slots) ? slots : (slots as { data?: unknown[] })?.data ?? [];
      const n = Array.isArray(arr) ? arr.length : 0;
      console.log(`  ${fecha}: ${n} slots`);
      if (n > 0) {
        console.log(`  ✅ Disponibilidad real funciona. Ejemplo:`, JSON.stringify(Array.isArray(arr) ? arr[0] : arr).slice(0, 160));
        break;
      }
    } catch (e) {
      console.log(`  ${fecha}: error — ${String(e).slice(0, 120)}`);
    }
  }

  console.log("\n✅ Cliente Dentalsoft operativo.");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
