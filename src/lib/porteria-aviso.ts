// El aviso que le llega a Lukas cuando alguien queda fuera del panel.
//
// Va por WhatsApp (no por correo) porque el bot ya está conectado: no hay servicio nuevo que pagar ni
// configurar, y llega al segundo. OJO con lo que esto SÍ y NO prueba: `enqueueOutbox` deja el mensaje
// EN LA COLA — lo despacha después el proceso del bot. Si el bot está desconectado, el aviso espera en
// la cola y no sale. Por eso existe además CODIGO_MAESTRO: la llave de respaldo que no depende del
// WhatsApp (ver `porteria-store.ts` y la ruta /api/login/reactivar).

import { getOrCreateConversation, insertMessage, enqueueOutbox } from "./db";

/** El teléfono al que van los avisos, normalizado. Vacío = nadie configuró TELEFONO_AVISOS. */
function destino(): string {
  const bruto = (process.env.TELEFONO_AVISOS ?? "").replace(/\D/g, "");
  if (!bruto) return "";
  let n = bruto;
  if (n.length === 9) n = "56" + n;          // 9 dígitos = celular chileno sin país
  if (!n.startsWith("56")) n = "56" + n;
  return n;
}

/**
 * Encola el aviso. No lanza nunca: si el aviso falla, el login TIENE que seguir funcionando
 * (un panel de clínica caído por un aviso sería peor que el problema que se está resolviendo).
 */
export function avisarCierre(opciones: {
  quien: string;
  codigo: string;
  cerradasEnTotal: number;
  panel: string;
}): { encolado: boolean; motivo?: string } {
  const phone = destino();
  if (!phone) return { encolado: false, motivo: "falta TELEFONO_AVISOS" };

  const { quien, codigo, cerradasEnTotal, panel } = opciones;
  const ataque = cerradasEnTotal >= 3;

  const texto = [
    ataque
      ? `🚨 OJO: hay ${cerradasEnTotal} conexiones distintas bloqueadas en el panel de ${panel}. Eso ya no parece un despiste, parece que alguien está probando contraseñas.`
      : `🔒 Alguien falló 6 veces la contraseña del panel de ${panel} y quedó bloqueado.`,
    ``,
    `Desde la conexión ${quien}.`,
    ``,
    `Si fue una de las chiquillas, dictale este código para que entre: ${codigo}`,
    `Si no reconoces a nadie intentando, no lo dictes y cambia la contraseña del panel.`,
  ].join("\n");

  try {
    const conv = getOrCreateConversation(phone, "Avisos del panel");
    insertMessage(conv.id, "human", texto);
    enqueueOutbox(conv.id, conv.phone, texto);
    return { encolado: true };
  } catch (e) {
    console.error("[porteria] no se pudo encolar el aviso:", e);
    return { encolado: false, motivo: String(e) };
  }
}
