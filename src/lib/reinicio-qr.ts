// REGENERAR EL CÓDIGO QR SIN QUE EL BOTÓN SE MUERA POR EL CAMINO.
//
// Lección del 28-jul-2026 (Medifis) repetida el 04-ago-2026 (Arteluk y Conejeros):
// en producción `auth/` es `/app/auth`, un VOLUMEN MONTADO de Docker. `fs.rmSync` sobre
// el punto de montaje falla con `EBUSY: resource busy` — borra lo de dentro y revienta al
// intentar quitar la carpeta. Como esa línea iba ANTES de escribir la señal de reinicio,
// la excepción abortaba la petición: el panel se quedaba girando en "Generando código QR…"
// para siempre y el motor de WhatsApp nunca se enteraba de que tenía que pedir uno nuevo.
//
// Regla: vaciar el CONTENIDO de la carpeta, nunca la carpeta; y que un fallo al limpiar
// jamás impida avisar al motor.
import fs from "fs";
import path from "path";

/** Borra las credenciales de dentro de `authDir` dejando la carpeta en pie. Nunca lanza. */
export function vaciarAuth(authDir: string): { borradas: number; fallos: number } {
  let borradas = 0;
  let fallos = 0;
  let entradas: string[];
  try {
    entradas = fs.readdirSync(authDir);
  } catch {
    return { borradas, fallos }; // la carpeta no existe todavía: no hay nada que limpiar
  }
  for (const entrada of entradas) {
    try {
      fs.rmSync(path.join(authDir, entrada), { recursive: true, force: true });
      borradas++;
    } catch {
      fallos++; // un fichero ocupado no puede frenar la regeneración del QR
    }
  }
  return { borradas, fallos };
}

/** Deja la señal que el motor de WhatsApp vigila cada segundo para pedir un QR nuevo. */
export function pedirReinicioQR(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, ".restart"), "");
}
