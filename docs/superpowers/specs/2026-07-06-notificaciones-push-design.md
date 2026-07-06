# Notificaciones (Arteluk + Meta) — Diseño

Fecha: 2026-07-06 · Repo: `lukasconejeros/whatsapp-mary`

## Objetivo
Avisar a Mary en el teléfono cuando llega un mensaje entrante clasificado como
**arteluk** (cliente) o **potencial** (lead de Meta). Dos mecanismos:
1. **App abierta** → sonido + notificación instantánea (vía el SSE que ya existe).
2. **App cerrada** → **Web Push real** (Service Worker + VAPID).

Ambos comparten la misma regla: *entrante + categoría ∈ {arteluk, potencial}*.

## Alcance (YAGNI)
- SOLO categorías arteluk y potencial. La columna "mary" (desconocidos) NO avisa.
- Solo mensajes ENTRANTES (role 'user'). Lo que envía Mary/el bot no avisa.
- No hay preferencias por-categoría ni horarios (se puede sumar después).

## Arquitectura

### A. Web Push (app cerrada)
- **`public/sw.js`** — Service Worker: escucha `push` → `showNotification(titulo, {body, data:{url}})`;
  escucha `notificationclick` → abre/enfoca la app en `data.url` (el chat o /inbox).
- **`src/lib/push.ts`** (server, proceso del bot) — usa la librería **`web-push`**:
  - `enviarPush({ titulo, cuerpo, url })`: envía a TODAS las suscripciones guardadas.
  - Si `web-push` devuelve 404/410 (suscripción muerta) → borra esa fila.
  - Si faltan claves VAPID → no hace nada (log) y la app sigue igual.
- **Tabla `push_subs`**: `id, endpoint UNIQUE, p256dh, auth, created_at`.
- **`GET /api/push/vapid`** → devuelve la clave pública VAPID (para suscribirse).
- **`POST /api/push/subscribe`** → guarda la suscripción del navegador (upsert por endpoint).
  Ambos protegidos por el middleware de login (solo Mary logueada).
- **Disparo**: en `handler.ts`, en el MISMO punto donde ya se clasifica el mensaje
  entrante (tras `classifyCategoria`/`setCategoria`): si la categoría final es arteluk o
  potencial, llamar `enviarPush({ titulo: nombre del contacto, cuerpo: preview del mensaje,
  url: /inbox })`. No bloquea el flujo (try/catch, fire-and-forget).

### B. Aviso con la app abierta (SSE)
- `GET /api/events` hoy emite `update` con el timestamp del último mensaje. Se amplía el
  payload del evento `update` para incluir `{ ts, categoria, nombre, preview }` del mensaje
  más reciente (leído de la DB en el mismo tick).
- El front (inbox) al recibir `update`: si `categoria ∈ {arteluk, potencial}` y el documento
  no está enfocado, reproduce un sonido corto y muestra `new Notification(nombre, { body })`
  (si hay permiso). Si está enfocado, solo recarga la lista (comportamiento actual).

### C. UI de activación
- Botón **🔔 "Activar notificaciones"** en la cabecera de **Chats** (`inbox`). Al tocarlo:
  1. `Notification.requestPermission()` (requiere gesto del usuario — por eso es un botón).
  2. Registra el Service Worker (`navigator.serviceWorker.register('/sw.js')`).
  3. `pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: <VAPID pública> })`.
  4. `POST /api/push/subscribe` con la suscripción.
  - Estados del botón: "Activar" → "Activadas ✓" (si ya hay permiso+suscripción) → "Bloqueadas"
    (si el usuario negó el permiso, con ayuda de cómo reactivar).
- **Manifest**: ya existe (`manifest.ts`); confirmar `display: 'standalone'` para que sea
  instalable como PWA (requisito de iOS).

## Datos que necesita Lukas
- **Claves VAPID** (yo las genero con `web-push`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (`mailto:lukas...`). Se ponen en EasyPanel. Sin ellas, el push se omite.
- **En el iPhone de Mary (una vez):** agregar la app a la pantalla de inicio (Compartir →
  "Agregar a inicio") y tocar "Activar notificaciones". iOS 16.4+ SOLO permite Web Push a PWAs
  instaladas — limitación de Apple, no del código.

## Manejo de errores
- Suscripción muerta (410/404 al enviar) → se borra sola.
- Sin VAPID → push omitido en silencio; el aviso in-app sigue funcionando.
- `web-push` nunca debe tumbar el bot: todo el disparo va en try/catch fire-and-forget.
- Permiso denegado → el botón lo refleja; no rompe nada.

## Testing
- `test-push` (tsx): `enviarPush` con VAPID de prueba encola/llama al transport mockeado;
  suscripción 410 → se borra; sin VAPID → no-op. Regla de disparo (categoría arteluk/potencial
  dispara, mary no) probada de forma aislada.
- Verificación manual: instalar PWA en un iPhone real, activar, y mandarse un mensaje de un
  número externo clasificado arteluk → llega la notificación con app cerrada.

## Dependencias nuevas
- `web-push` (npm). Pura JS, corre en el proceso del bot.

## Piezas y responsabilidad (una cosa cada una)
- `public/sw.js` — mostrar la notificación y abrir la app.
- `src/lib/push.ts` — enviar Web Push + limpiar suscripciones muertas.
- `src/app/api/push/*` — entregar la clave pública y guardar suscripciones.
- `handler.ts` (mínimo, aditivo) — disparar el push en el punto de clasificación.
- `inbox` UI — botón de activar + aviso in-app.
- `db.ts` — tabla `push_subs` + `addPushSub`/`listPushSubs`/`deletePushSub`.
