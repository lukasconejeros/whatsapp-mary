// Next ejecuta register() una vez al arrancar el servidor. Aprovechamos para
// cargar los contactos de Arteluk en la base de PRODUCCIÓN (que arranca vacía),
// sin depender de correr comandos a mano en el contenedor. Es idempotente y no
// pisa las etiquetas activo/inactivo que Mary haya puesto.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { seedContactosArteluk } = await import("./lib/seed-contactos");
    const r = seedContactosArteluk();
    console.log(`[seed] Arteluk: ${r.ok} contactos, ${r.conversaciones} conversaciones en Chats, ${r.defaulted} nuevos activos, total ${r.total}`);
  } catch (e) {
    console.error("[seed] no se pudieron cargar los contactos:", e);
  }
  // El horario de la academia (26-08-2026): las 9 fotos del Excel de Mary. Solo la
  // primera vez, con la tabla vacía — después manda lo que ella tenga en la app.
  try {
    const { seedHorarioSiVacio } = await import("./lib/horario-arteluk");
    const h = seedHorarioSiVacio();
    if (h.alumnos > 0) console.log(`[seed] horario Arteluk: ${h.alumnos} alumnos, ${h.inscripciones} inscripciones`);
  } catch (e) {
    console.error("[seed] no se pudo cargar el horario:", e);
  }
}
