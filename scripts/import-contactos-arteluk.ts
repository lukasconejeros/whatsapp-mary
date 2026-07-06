import "./env-loader.js";
import { seedContactosArteluk } from "../src/lib/seed-contactos.js";

// Carga manual de los contactos de Arteluk. También se ejecuta solo al arrancar
// la app (src/instrumentation.ts), así que en producción normalmente no hace falta.
const r = seedContactosArteluk();
console.log(`\n✅ Importados/actualizados: ${r.ok} (conversaciones en Chats: ${r.conversaciones})`);
if (r.defaulted) console.log(`   (${r.defaulted} contactos nuevos marcados como 'activo')`);
if (r.invalidos.length) {
  console.log(`\n⚠️  No se pudieron cargar (${r.invalidos.length}) — teléfono inválido o faltante:`);
  for (const s of r.invalidos) console.log(`   • ${s}`);
}
console.log(`\n📇 Total de contactos en la base: ${r.total}\n`);
