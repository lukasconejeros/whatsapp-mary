// Campaña de seguimiento: plantilla EDITABLE del mensaje y parámetros anti-baneo.
// Mary edita el texto en la pestaña Seguimiento (se guarda en config); la campaña lo
// manda a cada lead cerrado reemplazando los tokens {nombre} y {alumno}.

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

// Clave de config donde se guarda la plantilla editable.
export const SEGUIMIENTO_MSG_KEY = "seguimiento_msg";

// Plantilla por defecto (Mary la puede editar). Tokens: {nombre} = apoderado,
// {alumno} = niño/a. La promo: clase de prueba $18.000 (antes $25.000).
export const MENSAJE_SEGUIMIENTO_DEFAULT =
  "Hola {nombre} 🎨 Soy Mary, de la academia de arte Arteluk. Me encantaría invitar a {alumno} a nuestra clase de prueba. Tenemos una promoción: la clase de prueba queda en $18.000 (antes $25.000). ¿Te gustaría que agendemos un día para que venga a probar? — Mary, Arteluk";

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
