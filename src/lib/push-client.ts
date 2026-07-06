// Utilidades de notificaciones del lado del navegador (se llaman desde componentes
// cliente). Registra el Service Worker, pide permiso, se suscribe a Web Push, y suena
// un aviso corto sin necesidad de archivos de audio.

export type EstadoNoti = "activadas" | "bloqueadas" | "inactivas" | "no-soportado";

function soporta(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function estadoNotificaciones(): Promise<EstadoNoti> {
  if (!soporta()) return "no-soportado";
  if (Notification.permission === "denied") return "bloqueadas";
  if (Notification.permission === "granted") {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "activadas" : "inactivas";
  }
  return "inactivas";
}

function base64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function activarNotificaciones(): Promise<{ ok: boolean; error?: string }> {
  if (!soporta()) {
    return { ok: false, error: "Aquí no se pueden activar. En iPhone: primero agrega la app a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí." };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, error: "No diste permiso. Actívalo en los ajustes del teléfono para esta app." };
  }
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const { publicKey } = await fetch("/api/push/vapid").then((r) => r.json());
  if (!publicKey) {
    return { ok: false, error: "Faltan las claves del servidor (VAPID). Avísale a Lukas." };
  }
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(publicKey) as BufferSource,
    }));
  const json = sub.toJSON();
  const r = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  }).then((x) => x.json());
  return r.ok ? { ok: true } : { ok: false, error: "No se pudo guardar la suscripción." };
}

// Aviso sonoro corto (con la app abierta). Sin archivos: un beep con Web Audio.
export function sonarAviso(): void {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start();
    o.stop(ctx.currentTime + 0.26);
    o.onended = () => ctx.close();
  } catch { /* noop */ }
}
