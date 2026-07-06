// Next ejecuta register() una vez al arrancar el servidor. Aprovechamos para
// cargar los contactos de Arteluk en la base de PRODUCCIÓN (que arranca vacía),
// sin depender de correr comandos a mano en el contenedor. Es idempotente y no
// pisa las etiquetas activo/inactivo que Mary haya puesto.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { seedContactosArteluk } = await import("./lib/seed-contactos");
    const r = seedContactosArteluk();
    console.log(`[seed] contactos Arteluk cargados: ${r.ok} ok, ${r.defaulted} nuevos activos, total ${r.total}`);
  } catch (e) {
    console.error("[seed] no se pudieron cargar los contactos:", e);
  }
}
