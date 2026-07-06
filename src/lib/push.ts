import webpush from "web-push";
import { listPushSubs, deletePushSub } from "./db";

// Envía notificaciones Web Push a todos los dispositivos suscritos. Si no hay claves
// VAPID configuradas, no hace nada (la app sigue igual). Las suscripciones muertas
// (410/404) se borran solas. Nunca lanza: el disparo es fire-and-forget.

let configurado = false;
function configurar(): boolean {
  if (configurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:arteluk@conejeros.cl";
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configurado = true;
    return true;
  } catch {
    return false;
  }
}

export function pushConfigurado(): boolean {
  return configurar();
}

export async function enviarPush(data: { titulo: string; cuerpo: string; url?: string; tag?: string }): Promise<void> {
  if (!configurar()) return; // sin VAPID → no-op silencioso
  const payload = JSON.stringify({
    titulo: data.titulo,
    cuerpo: data.cuerpo,
    url: data.url ?? "/inbox",
    tag: data.tag, // un tag por conversación evita que un aviso pise al de otro cliente
  });
  const subs = listPushSubs();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) deletePushSub(s.endpoint);
      }
    })
  );
}
