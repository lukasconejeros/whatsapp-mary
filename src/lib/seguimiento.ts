// Envíos masivos: DOS plantillas editables (Meta y Seguimiento), guardadas en config.
//  - Meta: promo para invitar a los leads a la clase de prueba.
//  - Seguimiento: mensaje para los que ya pagaron la prueba (que se inscriban al taller).
// Cada envío personaliza los tokens {nombre} y {alumno} por contacto al encolar.

function envInt(name: string, def: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Parámetros de la campaña (overridables por env para pruebas).
export const CAMPANA = {
  get capDiario() { return envInt("SEGUIMIENTO_MAX_DIA", 35); },                    // tope de envíos por día
  get horaInicio() { return clamp(envInt("SEGUIMIENTO_HORA_INICIO", 9), 0, 23); },  // no mandar antes de las 9
  get horaFin() { return clamp(envInt("SEGUIMIENTO_HORA_FIN", 21), 1, 24); },       // ni después de las 21
  get pausaMinS() { return envInt("SEGUIMIENTO_PAUSA_MIN_S", 40); },                // pausa mínima entre envíos
  get pausaMaxS() { return envInt("SEGUIMIENTO_PAUSA_MAX_S", 90); },                // pausa máxima entre envíos
};

// Claves de config de cada plantilla editable.
export const MSG_META_KEY = "msg_meta";
export const MSG_SEGUIMIENTO_KEY = "msg_seguimiento";

// Plantilla META (promo a los leads). Sin nombre del apoderado/niño: de los leads no
// lo sabemos, así que el mensaje es genérico.
export const MENSAJE_META_DEFAULT =
  "¡Hola! 🎨 Soy Mary, de la academia de arte Arteluk. Me encantaría invitarte a nuestra clase de prueba. Tenemos una promoción: la clase de prueba queda en $18.000 (antes $25.000). ¿Te gustaría que agendemos un día para venir a probar?";

// Plantilla SEGUIMIENTO (a los que ya pagaron la prueba, para que se inscriban). Genérico.
export const MENSAJE_SEGUIMIENTO_DEFAULT =
  "¡Hola! 🎨 Soy Mary, de la academia de arte Arteluk. Me encantó tenerte en la clase de prueba y me encantaría que sigas aprendiendo con nosotros. ¿Te gustaría que conversemos para inscribirte en el taller?";

// Reemplaza {nombre}/{alumno} por los datos del contacto y limpia espacios sobrantes
// si algún dato falta. Lo que Mary escribe es lo que se manda (sin reescritura de IA).
export function personalizarMensaje(template: string, nombre?: string | null, alumno?: string | null): string {
  return template
    .replace(/\{nombre\}/gi, (nombre && nombre.trim()) || "")
    .replace(/\{alumno\}/gi, (alumno && alumno.trim()) || "tu hijo/a")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/Hola\s+,/g, "Hola,")
    .replace(/\s+([.!?,])/g, "$1")
    .trim();
}
