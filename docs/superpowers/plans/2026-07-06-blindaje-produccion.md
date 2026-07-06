# Blindaje de Producción — Plan de Implementación

> **Para ejecutores:** implementar fase por fase con revisión entre fases. Cada fase es
> desplegable y verificable de forma independiente. Pasos con checkbox `- [ ]`.

**Objetivo:** Corregir de raíz (no parchear) los hallazgos de la auditoría del 2026-07-06
para que la app de Arteluk sea confiable, privada y segura en producción, verificando que
cada arreglo quede *blindado* (con criterio de aceptación comprobable).

**Arquitectura:** Next.js (web) + Baileys (bot) en dos procesos sobre SQLite/WAL, en
EasyPanel detrás de una URL pública. Los arreglos van por subsistema; cada fase se prueba
con scripts `tsx` (patrón `scripts/test-*.ts`), `curl`, y build, y se despliega vía el
webhook antes de pasar a la siguiente.

**Tech Stack:** TypeScript, Next 16, better-sqlite3, @whiskeysockets/baileys 6.7.x, ffmpeg.

## Restricciones globales (aplican a TODA tarea)

- **Nunca romper el envío de texto/imagen/audio ya funcionando** — todo cambio en `baileys/`
  es aditivo y preserva el camino actual.
- **`typescript.ignoreBuildErrors` sigue true**, pero cada fase debe pasar `npx tsc --noEmit`
  sin errores NUEVOS (los 4 preexistentes en `ai.ts`/`baileys/client.ts` no cuentan) y
  `npm run build` OK.
- **Cada fase termina con:** tests verdes + build OK + commit + deploy (webhook
  `http://212.85.12.196:3000/api/deploy/9339145a516ae8e8d7b87f522dd1251e3ec9361bc843c9c8`)
  + verificación en prod (GET a endpoints; POST multipart desde el shell da HTTP000 = usar
  script Node `fetch`).
- **Idempotencia y dos procesos:** todo lo que corra al arrancar (migraciones, seed) debe
  tolerar que bot y web arranquen a la vez contra la misma DB.
- **Verificación "blindado":** cada tarea define un criterio de aceptación reproducible. No
  se marca hecha sin cumplirlo.
- Español chileno con tuteo en textos de UI.

---

## FASE 1 — Blindaje del pipeline de envío (outbox)

**Entrega:** el bot no duplica mensajes y una falla no mata la cola. Es la fase más urgente
(duplicados de audio/foto reportados).

### Task 1.1: Candado de reentrada en el loop del outbox (arregla duplicados)

**Files:**
- Modify: `src/lib/baileys/outbox.ts`

**Causa raíz:** `setInterval(async …, 2000)` no espera a que termine la pasada anterior; con
envíos > 2 s (audio/foto) el siguiente tick relee los mismos items `sent=0` y reenvía.

**Fix profesional (no parche):** reemplazar `setInterval` por un `setTimeout` que se
reprograma **después** de completar cada pasada. Así nunca hay dos pasadas solapadas y el
intervalo se mide desde el fin (backpressure natural).

- [ ] **Paso 1:** Reescribir `startOutboxLoop`:
```ts
let outboxTimer: ReturnType<typeof setTimeout> | null = null;
let corriendo = false;

export function startOutboxLoop(sock: WASocket): void {
  if (outboxTimer || corriendo) return;
  const tick = async () => {
    corriendo = true;
    try {
      const pending = getPendingOutbox(20);
      for (const item of pending) {
        try { /* … envío actual, sin cambios … */ }
        catch (err) { /* … Task 1.2 … */ }
      }
    } finally {
      corriendo = false;
      outboxTimer = setTimeout(tick, 2000); // reprograma DESPUÉS de terminar
    }
  };
  outboxTimer = setTimeout(tick, 0);
}

export function stopOutboxLoop(): void {
  if (outboxTimer) { clearTimeout(outboxTimer); outboxTimer = null; }
}
```
- [ ] **Paso 2:** Verificación (script `scripts/test-outbox.ts`, mock del sock con
  `sendMessage` que tarda 3 s): encolar 1 item, arrancar el loop con el mock, esperar 5 s,
  aseverar que `sendMessage` se llamó **exactamente 1 vez** (antes: ≥2). Correr:
  `npx tsx scripts/test-outbox.ts`.
- [ ] **Blindado:** con `sendMessage` de 3 s, 1 item → 1 sola llamada; `getPendingOutbox`
  nunca devuelve un item ya en vuelo.

### Task 1.2: Contador de intentos (arregla poison-pill / cola muerta)

**Files:**
- Modify: `src/lib/db.ts` (schema outbox + micro-migración + `getPendingOutbox` + nueva `markOutboxFailed`)
- Modify: `src/lib/baileys/outbox.ts` (catch)

**Causa raíz:** un item que siempre falla se reintenta para siempre y, si se acumulan 20,
`LIMIT 20` sólo devuelve poison-pills → los mensajes nuevos nunca salen.

**Fix:** columna `attempts` (default 0). En el catch, incrementar; al llegar a `MAX_INTENTOS`
(5) marcar `sent=2` (fallido) y sacarlo de la cola. `getPendingOutbox` filtra `sent=0`.

- [ ] **Paso 1:** Schema `outbox` + micro-migración: `ALTER TABLE outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0` (dentro del bloque try/catch de la Fase 5, pero se puede adelantar con su propio try/catch).
- [ ] **Paso 2:** `markOutboxFailed(id)` → `UPDATE outbox SET sent=2 WHERE id=?`; y
  `bumpOutboxAttempt(id): number` → `UPDATE … SET attempts=attempts+1 WHERE id=? RETURNING attempts`.
- [ ] **Paso 3:** En el catch del loop:
```ts
const n = bumpOutboxAttempt(item.id);
if (n >= 5) { markOutboxFailed(item.id); logger.error({ id: item.id, n }, "Outbox: item fallido tras 5 intentos, descartado"); }
```
- [ ] **Paso 4:** Verificación (extender `test-outbox.ts`): item con `sendMessage` que
  siempre lanza → tras 5 pasadas queda `sent=2` y NO vuelve en `getPendingOutbox`; un item
  bueno encolado después SÍ sale.
- [ ] **Blindado:** 1 item venenoso no bloquea; se descarta a los 5 intentos; los buenos fluyen.

**Fin de fase:** `npx tsx scripts/test-outbox.ts` verde · build OK · commit · deploy · en prod
`GET /api/diag` (aún existe en esta fase) muestra `audiosEncolados` sin acumulación.

---

## FASE 2 — Resiliencia del bot (conexión + handler)

**Entrega:** el bot se recupera de fallos de reconexión, no pierde respuestas y no responde doble.

### Task 2.1: Reconexión a prueba de fallos

**Files:** Modify `src/lib/baileys/client.ts` (`scheduleReconnect`)

**Causa raíz:** `await start()` sin try/catch; si rechaza → `unhandledRejection` (mata el
proceso) y como `reconnectTimer` ya es `null`, nadie reprograma → bot muerto.

**Fix:**
```ts
reconnectTimer = setTimeout(async () => {
  reconnectTimer = null;
  try { await start(); }
  catch (err) { logger.error({ err }, "Fallo al reconectar; reintentando"); scheduleReconnect(code); }
}, delay);
```
- [ ] **Verificación:** revisión de código + `tsc`/build (no hay test automatizable sin
  romper la sesión). **Blindado:** todo camino de `start()` que lance vuelve a agendar
  reconexión; no queda `await` sin try/catch en timers.

### Task 2.2: La respuesta del bot va por el outbox (no envío directo) + lecturas DB dentro del try

**Files:** Modify `src/lib/baileys/handler.ts` (callback del debounce)

**Causa raíz:** el reply se hace con `sock.sendMessage` directo (sin reintentos, `sock`
posiblemente obsoleto tras reconexión) y `insertMessage(assistant)` ocurre ANTES del envío
(queda "enviado" aunque falle). Además `getRecentHistory`/`getConversationById` están fuera
del try → `SQLITE_BUSY` mata el proceso.

**Fix:** mover las lecturas dentro del try; y en vez de `sock.sendMessage(jid,{text:reply})`,
usar `enqueueOutbox(convId, phone, reply)` + `insertMessage(convId,"assistant",reply)` juntos
(mismo patrón que `/api/send`). Así hereda reintentos y usa el `sock` vigente del outbox.
- [ ] **Verificación:** revisión + build. **Blindado:** no queda `sock.sendMessage` en el
  camino de auto-respuesta; toda salida al cliente pasa por el outbox.

### Task 2.3: Debounce por `convId` (arregla doble respuesta @lid)

**Files:** Modify `src/lib/baileys/handler.ts`

**Causa raíz:** `debounceTimers` se indexa por `phone`; con @lid + número real hay dos phones
para el mismo `convId` deduplicado → dos timers → doble respuesta.

**Fix:** indexar `debounceTimers` por `String(convo.id)`.
- [ ] **Verificación:** revisión + build. **Blindado:** la clave del debounce es el id de
  conversación (ya deduplicado), no el phone.

### Task 2.4: Guardas de env numéricas (NaN → default)

**Files:** Modify `src/lib/baileys/handler.ts`

**Fix:** helper `numEnv(name, def)` con `Number.isFinite`; usar en `DEBOUNCE_MS`,
`REPLY_DELAY_MIN/MAX`, `QUIET_HOUR_START/END`.
- [ ] **Verificación:** `scripts/test-envnum.ts` (o revisión). **Blindado:** un env mal
  escrito no pone delays en 0 ni desactiva el quiet-hour.

### Task 2.5: Quiet-hour con respuesta diferida real

**Files:** Modify `src/lib/baileys/handler.ts` + `src/lib/db.ts` + `scripts/start-bot.ts`

**Causa raíz:** en horario silencioso se hace `continue` y la respuesta se descarta para siempre.

**Fix:** marcar la conversación como "respuesta pendiente" (columna `pending_reply INTEGER`
en conversations, o tabla `pending_replies`), y en `start-bot` un intervalo que, al salir del
horario silencioso, genere+encole la respuesta de las conversaciones AI con último mensaje
`user` sin contestar. Es el único camino AI (poco usado hoy, pero se blinda).
- [ ] **Verificación:** `scripts/test-quiethour.ts` con reloj inyectado. **Blindado:** un
  mensaje entrante en horario silencioso queda marcado y se responde al reabrir la ventana.

**Fin de fase:** tests verdes · build · commit · deploy.

---

## FASE 3 — Autenticación y superficie HTTP (defensa en profundidad)

**Entrega:** la app deja de estar abierta al mundo. Login propio en el código (no depende sólo
de Cloudflare) + quitar el endpoint de diagnóstico + errores que no filtren internos.

### Task 3.1: Middleware de sesión que protege TODO

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/api/login/route.ts`
- Modify: `.env.example` (documentar `PANEL_PASSWORD`, `SESSION_SECRET`)

**Causa raíz:** no hay autenticación; la URL pública expone PII y control del bot.

**Fix profesional:** middleware de Next que exige una cookie de sesión firmada en TODAS las
rutas, salvo una allowlist: `/login`, `/api/login`, `/_next/*`, favicon, y los endpoints
máquina que YA validan su propio secreto (`/api/send-direct`, `/api/contexto`,
`/api/movimientos`). Login = página con campo de contraseña → `POST /api/login` compara con
`PANEL_PASSWORD` (env) y setea cookie `sesion` HttpOnly firmada con `SESSION_SECRET`
(HMAC, sin dependencias nuevas: `crypto`). Middleware valida la firma.
- [ ] **Paso 1:** `src/app/api/login/route.ts`: `POST {password}` → si `=== PANEL_PASSWORD`,
  `Set-Cookie: sesion=<hmac>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`.
- [ ] **Paso 2:** `src/middleware.ts` con `matcher` que excluye estáticos; verifica cookie o
  header de secreto de los endpoints máquina; si no, redirige a `/login` (páginas) o `401`
  (rutas `/api/*`).
- [ ] **Paso 3:** `src/app/login/page.tsx`: form rosado simple (input password + botón),
  `POST /api/login`, al 200 redirige a `/inbox`.
- [ ] **Verificación (blindado):**
  `curl -s -o /dev/null -w "%{http_code}" $PROD/api/conversations` → **401**;
  con cookie válida → 200; `POST /api/login` con contraseña correcta → set-cookie;
  con incorrecta → 401. `GET /inbox` sin cookie → redirect a `/login`.

### Task 3.2: Quitar `/api/diag` de producción

**Files:** Delete `src/app/api/diag/route.ts`

**Causa raíz:** ejecuta ffmpeg sobre archivos subidos sin auth/límite (yo lo dejé para
auditar; ya cumplió).
- [ ] **Verificación (blindado):** `GET $PROD/api/diag` → **404**.

### Task 3.3: Rate-limit ligero + errores genéricos en endpoints de IA/subida

**Files:** Create `src/lib/ratelimit.ts` (in-memory por IP+ruta) · Modify rutas
`asistente`, `suggest`, `transcribir`, `send-media`, `foto`, `config` (no devolver `String(e)`).

**Fix:** limitador en memoria (ventana deslizante, p.ej. 20 req/min por IP) en las rutas que
gastan IA/CPU; y respuestas de error genéricas (`{ok:false,error:"Error interno"}`) con el
detalle sólo en `logger`.
- [ ] **Verificación (blindado):** 30 POST rápidos a `/api/suggest` → algunos **429**;
  ninguna respuesta contiene rutas del filesystem.

**Fin de fase:** build · commit · deploy · verificación curl. **Nota para Lukas:** además,
activar **Cloudflare Access** delante del dominio (capa de infraestructura) — el middleware es
defensa en profundidad, no reemplaza el login perimetral.

---

## FASE 4 — Privacidad y seguridad del feedback

**Entrega:** imposible mandar fotos al apoderado equivocado, imposible exfiltrar archivos, y no
se envía nada sin confirmación real.

### Task 4.1: Validación de nombres de archivo (arregla path traversal)

**Files:** Create `src/lib/media-path.ts` (`esNombreMediaSeguro(name): boolean` — sólo
basename, sin `/ \ ..`, y que `path.resolve(MEDIA_DIR,name)` quede dentro de `MEDIA_DIR`).
Modify `src/lib/feedback.ts` (filtra `fotos`), `src/app/api/asistente/route.ts` (filtra
`fotos` del body), `src/lib/baileys/outbox.ts` (guard antes de leer).

- [ ] **Paso 1 (test primero):** `scripts/test-media-path.ts`: `esNombreMediaSeguro("a.jpg")`
  true; `"../../.env"`, `"/etc/passwd"`, `"a/b.jpg"`, `"..\\x"` → false.
- [ ] **Paso 2:** implementar y aplicar en los 3 puntos.
- [ ] **Blindado:** `fotos:["../../.env"]` en `/api/asistente` no crea borrador con esa foto;
  el outbox nunca lee fuera de `data/media`.

### Task 4.2: Herencia de fotos sólo si es el MISMO destinatario

**Files:** Modify `src/lib/feedback.ts` (`prepararEnvio`)

**Causa raíz:** hereda `prev.fotos` sin comparar destinatario → fotos de un niño al apoderado
de otro.

**Fix:** heredar sólo si el nuevo turno **no** trae fotos **y** el destinatario coincide con
el del borrador previo (mismo `cliente_telefono` resuelto, o mismo texto de `destinatario`
normalizado). Si el destinatario cambió, NO heredar (exigir readjuntar).
- [ ] **Paso 1 (test):** extender `test-feedback.ts`: borrador para "Amparo" con 2 fotos sin
  confirmar → `prepararEnvio({destinatario:"Sofía", mensaje:"..."})` (Sofía existe) → el
  borrador de Sofía tiene **0 fotos**.
- [ ] **Blindado:** ningún borrador hereda fotos de un destinatario distinto.

### Task 4.3: Confirmación determinista antes de enviar

**Files:** Modify `src/app/api/asistente/route.ts` (rama `enviar`) + `src/lib/feedback.ts`

**Causa raíz:** `ejecutarEnvio()` corre si la IA dice `enviar`, sin verificar que Mary aprobó.

**Fix:** antes de `ejecutarEnvio`, exigir que el texto del turno de Mary contenga una
afirmación (`/\b(s[ií]|dale|env[ií]a|env[ií]alo|conf[ií]rmo|correcto|ok|ya)\b/i`) **o** que el
borrador esté en estado `borrador` (con contacto resuelto) y creado en el turno anterior. Si
no, responder pidiendo confirmación en vez de enviar.
- [ ] **Paso 1 (test):** `enviar` con texto "no, mejor no" → NO envía (borrador sigue).
- [ ] **Blindado:** un `enviar` del modelo sin un "sí" real de Mary no dispara el envío.

### Task 4.4: Caducidad del borrador

**Files:** Modify `src/lib/db.ts` (`getBorradorPendiente` con ventana temporal) + `feedback.ts`

**Fix:** `getBorradorPendiente` sólo devuelve borradores con `created_at >= now - 30min`.
Los más viejos se ignoran (y opcionalmente se marcan `cancelado`).
- [ ] **Paso 1 (test):** borrador con `created_at` de hace 40 min → `getBorradorPendiente()`
  = null; `ejecutarEnvio()` responde "no hay nada preparado".
- [ ] **Blindado:** un "sí" de otra acción no dispara un borrador viejo.

### Task 4.5: No enviar teléfonos ni finanzas crudas a la IA

**Files:** Modify `src/lib/asistente.ts` (`construirContexto`)

**Causa raíz:** se vuelca `tel:` de todos los clientes y todas las filas de finanzas al prompt
en cada llamada (fuga de PII + costo/latencia crecientes).

**Fix:** en el contexto, listar clientes por nombre/alumno **sin teléfono** (el teléfono se
resuelve determinista en `searchClientes`), y resumir finanzas a **totales por categoría** en
vez de filas crudas.
- [ ] **Blindado:** el system prompt no contiene ningún número de teléfono; el tamaño del
  contexto no crece linealmente con la base.

### Task 4.6: Búsqueda por límite de palabra + confirmar match dudoso

**Files:** Modify `src/lib/db.ts` (`searchClientes`) + `src/lib/feedback.ts`

**Causa raíz:** `includes` (substring) resuelve "Ana" → "Mariana" con match único.

**Fix:** hacer match por **token/prefijo de palabra** (dividir en palabras y comparar inicio
de token), no substring puro. Y en `prepararEnvio`, si la query es muy corta (< 3 chars) o el
match único proviene sólo de coincidencia parcial, tratarlo como ambiguo (pedir nombre completo).
- [ ] **Paso 1 (test):** "Ana" no matchea "Mariana"; "Amparo" sí matchea "Amparo Coronado".
- [ ] **Blindado:** no se crea borrador con contacto resuelto por coincidencia parcial dudosa.

**Fin de fase:** `test-feedback.ts` + `test-media-path.ts` verdes · build · commit · deploy.

---

## FASE 5 — Integridad de datos (DB)

**Entrega:** migraciones y seed a prueba de dos procesos; sin datos huérfanos ni orden inestable.

### Task 5.1: Migraciones `ALTER TABLE` idempotentes

**Files:** Modify `src/lib/db.ts` (`build()`)

**Causa raíz:** dos procesos corren el mismo `ALTER` a la vez tras un deploy → `duplicate
column name` → el proceso crashea.

**Fix:** helper `addColumnaSiFalta(db, tabla, col, tipo)` que envuelve el `ALTER` en try/catch
e ignora el error de columna duplicada; reemplazar todos los `ALTER` sueltos por él.
- [ ] **Paso 1 (test):** `scripts/test-migracion.ts` que llama al helper dos veces sobre la
  misma columna → no lanza.
- [ ] **Blindado:** correr `build()` dos veces seguidas (simular doble arranque) no lanza.

### Task 5.2: Seed transaccional y sin pisar ediciones manuales

**Files:** Modify `src/lib/db.ts` (nueva `upsertClienteSoloNuevo` o flag) + `src/lib/seed-contactos.ts`

**Causa raíz:** el seed corre en cada arranque y `upsertCliente` pisa `nombre`/`alumnos` con
los valores hardcodeados; además son ~180 escrituras sueltas.

**Fix:** (a) para el seed, usar `INSERT … ON CONFLICT(telefono) DO NOTHING` respecto de
`nombre`/`alumnos` (no sobrescribe si ya existe); (b) envolver todo el seed en una sola
`db.transaction()`.
- [ ] **Paso 1 (test):** sembrar; cambiar a mano `nombre` de un cliente; volver a sembrar →
  el nombre editado se conserva.
- [ ] **Blindado:** re-seed no revierte ediciones; el seed corre en una transacción.

### Task 5.3: Dedup por nombre más estricto (no mezclar contactos)

**Files:** Modify `src/lib/db.ts` (`getOrCreateConversation`)

**Causa raíz:** fusiona conversaciones por `pushName` de ≥4 chars → dos personas con el mismo
nombre se mezclan y el `jid` se re-apunta al segundo número.

**Fix:** sólo deduplicar por nombre si **además** no hay ya una conversación con ese número, y
**nunca** re-apuntar el `jid` de una conversación que ya tiene mensajes de otro número sin
que el número real coincida. Preferir no fusionar ante ambigüedad (crear conversación nueva).
- [ ] **Paso 1 (test):** dos "Sergio" con números distintos → dos conversaciones separadas.
- [ ] **Blindado:** mensajes de números distintos nunca caen en la misma conversación por nombre.

### Task 5.4: Borrado de conversación sin dejar huérfanos

**Files:** Modify `src/lib/db.ts` (`deleteConversation`)

**Causa raíz:** `leads.conversation_id` (FK RESTRICT) impide borrar; `feedbacks` quedan sueltos.

**Fix:** dentro de la transacción, borrar/anular también `leads` (WHERE conversation_id) y
`feedbacks` asociados (por teléfono) antes del `DELETE FROM conversations`.
- [ ] **Paso 1 (test):** crear conversación + lead + feedback enviado → `deleteConversation`
  no lanza y deja todo limpio.
- [ ] **Blindado:** borrar un chat con lead asociado funciona sin `SQLITE_CONSTRAINT`.

### Task 5.5: Orden estable de mensajes

**Files:** Modify `src/lib/db.ts` (`getMsgs`, `getRecentHistory`)

**Fix:** `ORDER BY created_at ASC, id ASC` (y `DESC, id DESC` en el reciente).
- [ ] **Blindado:** dos mensajes en el mismo segundo salen en orden de inserción; el historial
  al LLM nunca invierte user/assistant.

**Fin de fase:** tests verdes · build · commit · deploy.

---

## FASE 6 — Robustez del frontend

**Entrega:** nada de recursos colgados, envíos que mientan, ni duplicados por doble toque.

### Task 6.1: Limpieza de micrófono/grabación al desmontar

**Files:** Modify `src/components/ConversationView.tsx` y `src/app/asistente/page.tsx`

**Causa raíz:** al cambiar de chat/pantalla mientras se graba, el `stream`/`MediaRecorder`/
`SpeechRecognition`/`setInterval` no se liberan (micrófono queda encendido).

**Fix:** guardar el `MediaStream` en un ref y agregar `useEffect(() => () => { … stop … }, [])`
que detenga recorder, tracks del stream, reconocimiento y el timer.
- [ ] **Blindado:** desmontar el componente mientras graba apaga el micrófono (indicador iOS
  se apaga) y limpia el intervalo.

### Task 6.2: Envío consciente de la conexión + sin fallos silenciosos

**Files:** Modify `src/app/api/send/route.ts`, `src/app/api/send-media/route.ts`,
`src/components/ConversationView.tsx`

**Causa raíz:** `/api/send` siempre devuelve ok aunque WhatsApp esté desconectado; el envío de
audio/foto no tiene `catch` → falla en silencio.

**Fix:** las rutas devuelven `{ok:true, estado:'en_cola'|'conectado'}` según `connection_state`;
la UI marca los mensajes en cola distinto (reloj/✓ tenue) y muestra aviso si está desconectado;
agregar `catch` al envío de audio con aviso "no se pudo enviar, reintenta".
- [ ] **Blindado:** con WhatsApp desconectado, Mary ve "en cola / sin conexión", no un falso
  "enviado"; un fallo de red al mandar audio muestra error, no silencio.

### Task 6.3: Guardas anti doble-envío en Finanzas/Calendario

**Files:** Modify `src/app/finanzas/page.tsx`, `src/app/calendario/page.tsx`

**Fix:** estado `guardando` que deshabilita el botón durante el POST + `catch` con aviso.
- [ ] **Blindado:** doble toque en "Guardar" crea **un** registro; un POST fallido avisa y no
  deja el modal mudo.

### Task 6.4: Confirmación antes de borrar

**Files:** Modify `src/app/finanzas/page.tsx`, `src/app/calendario/page.tsx`

**Fix:** `confirm()` antes de `del()` + `catch`.
- [ ] **Blindado:** un toque accidental en la papelera no borra sin preguntar.

### Task 6.5: Chat en vivo que reconecta + hilo abierto en vivo

**Files:** Modify `src/app/inbox/page.tsx`, `src/components/ConversationView.tsx`

**Causa raíz:** `es.onerror = () => es.close()` apaga el SSE para siempre; el chat abierto no
se actualiza con mensajes entrantes.

**Fix:** no cerrar el `EventSource` en `onerror` (dejar que el navegador reconecte, o reintento
con backoff); y refrescar los mensajes del chat abierto ante el evento SSE (o polling ligero
cada ~5 s mientras el chat esté abierto).
- [ ] **Blindado:** tras un corte de red, la lista vuelve a actualizarse sola; un mensaje
  entrante aparece en el chat abierto sin reabrir.

### Task 6.6: Estados de error en las cargas

**Files:** Modify `inbox`, `contactos`, `feedbacks`, `calendario`, `finanzas` pages y `ConversationView`

**Fix:** `.catch` en los `fetch` iniciales → estado de error con botón "reintentar" (no
mostrar "vacío" cuando en realidad falló la red).
- [ ] **Blindado:** con señal caída, Mary ve "no se pudo cargar, reintentar", no datos vacíos
  engañosos.

### Task 6.7: Liberar blob URLs y manejar `play()`

**Files:** Modify `src/app/asistente/page.tsx` (`quitarFoto`/envío), `src/components/MediaContent.tsx`

**Fix:** `URL.revokeObjectURL` al quitar/enviar fotos; `a.play().catch(()=>setPlaying(false))`
y pausar otros audios al reproducir uno.
- [ ] **Blindado:** sesión larga con muchas fotos no crece en memoria; el botón de audio no
  queda en "pausa" sin sonar.

**Fin de fase:** build OK · verificación manual guiada (checklist en el teléfono) · commit · deploy.

---

## Orden de ejecución recomendado

1 (envío, urgente por duplicados) → 3 (auth, urgente por exposición) → 4 (privacidad feedback)
→ 2 (resiliencia bot) → 5 (integridad DB) → 6 (frontend). Cada fase se despliega y se prueba
antes de la siguiente.

## Verificación final (todas las fases)

- [ ] Todos los `scripts/test-*.ts` verdes.
- [ ] `npx tsc --noEmit` sin errores nuevos · `npm run build` OK.
- [ ] Checklist de seguridad en prod: `curl` sin cookie a 5 endpoints → 401; `/api/diag` → 404.
- [ ] Checklist funcional en el iPhone de Mary: enviar texto/foto/audio (sin duplicados),
      grabar y cambiar de chat (micrófono se apaga), dictar en el Asistente, doble-toque en
      Guardar (un registro), borrar con confirmación.
- [ ] Prueba de humo del bot: reiniciar el servicio y confirmar que reconecta solo y la cola
      drena sin duplicar.
