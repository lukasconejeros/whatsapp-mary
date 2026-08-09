# Errores conocidos del WhatsApp AI Agent Kit

Documento de referencia. Consultar ANTES de improvisar soluciones.

---

## #1 — El bot no responde a mis mensajes

**Síntoma**: Envías un mensaje desde tu móvil al número vinculado y no pasa nada.

**Causa**: Estás enviando desde el mismo número vinculado. Los mensajes `fromMe` se ignoran a propósito.

**Solución**: Prueba siempre desde OTRO móvil o número diferente.

---

## #2 — El QR aparece pero no conecta (código 440)

**Síntoma**: Escaneas el QR, aparece "Dispositivo vinculado" en WhatsApp pero el bot vuelve a mostrar QR.

**Causa**: `connectionReplaced` — WhatsApp rechazó el fingerprint o hay otra sesión activa.

**Solución**: El kit ya maneja esto con `Browsers.macOS('Desktop')` y backoff de 15s. Si persiste:
1. Borra la carpeta `auth/`
2. Reinicia el bot
3. Escanea el QR de nuevo

---

## #3 — Error 401 (loggedOut)

**Síntoma**: El bot muestra "Sesión cerrada (logout)" en los logs.

**Causa**: WhatsApp cerró la sesión remotamente (desde la app, sección Dispositivos vinculados).

**Solución**: Borrar `auth/` y escanear QR de nuevo. El kit NO reconecta en este caso (es correcto).

---

## #4 — Mensajes perdidos en WhatsApp 2025+ (@lid)

**Síntoma**: Algunos usuarios no reciben respuesta aunque el bot está conectado.

**Causa**: WhatsApp está migrando a LIDs (identificadores internos). Los JIDs terminan en `@lid` en lugar de `@s.whatsapp.net`.

**Solución**: El handler ya acepta ambos formatos. Si ves mensajes perdidos, verifica que `handler.ts` tiene la comprobación de `@lid`.

---

## #5 — SQLITE_BUSY durante `npm run build`

**Síntoma**: El build de Next.js falla con `database is locked` o `SQLITE_BUSY`.

**Causa**: `db.ts` se inicializa al importar (no lazy). Next.js lanza ~10 workers paralelos que abren la DB simultáneamente.

**Solución**: La inicialización DEBE ser lazy (función `ctx()` → `build()`). Si alguien eliminó ese patrón, restaurarlo.

---

## #6 — Error 405 (versión desactualizada de Baileys)

**Síntoma**: El bot se conecta pero WhatsApp lo rechaza con código 405.

**Causa**: La versión de WhatsApp Web que usa Baileys está desactualizada.

**Solución**: El kit llama a `fetchLatestBaileysVersion()` en cada arranque. Si persiste, actualiza `@whiskeysockets/baileys` con `npm update @whiskeysockets/baileys`.

---

## #7 — better-sqlite3 falla al instalar en Windows

**Síntoma**: `npm install` falla con error de compilación nativa.

**Causa**: Falta Visual Studio Build Tools (compilador C++).

**Solución**:
1. Descarga Visual Studio Build Tools desde visualstudio.microsoft.com
2. Instala el componente "Desarrollo de escritorio con C++"
3. Ejecuta `npm rebuild better-sqlite3`

---

## #8 — El dashboard muestra conversaciones pero el agente no envía

**Síntoma**: Los mensajes aparecen en el panel pero el bot no responde.

**Causa A**: La conversación está en Modo HUMAN.
**Causa B**: `OPENROUTER_API_KEY` inválida o sin crédito.
**Causa C**: El proceso del bot no está corriendo.

**Solución**: Verificar modo en el toggle del panel. Ejecutar `npm run doctor`.

---

## #9 — El bot envía respuestas duplicadas

**Síntoma**: Por cada mensaje del lead, el bot envía 2 respuestas iguales.

**Causa**: Hay dos instancias del bot corriendo (procesos zombie).

**Solución**: Cierra todas las terminales. En Windows: Administrador de tareas → buscar `node.exe` y terminar los que sobren. Reinicia con `npm run start:all`.

---

## #10 — El panel web muestra error 500

**Síntoma**: El dashboard da error 500 en alguna ruta API.

**Causa más común**: La DB no existe aún (bot nunca arrancado) y una ruta API intenta leerla.

**Solución**: Arranca el bot primero (`npm run start:all`) antes de abrir el panel.

---

## #11 — QR caducado (>60 segundos)

**Síntoma**: El QR aparece en pantalla pero al escanearlo dice "QR no válido".

**Causa**: Los QR de WhatsApp caducan en ~60 segundos.

**Solución**: Recargar la página del panel. El bot genera un nuevo QR automáticamente.

---

## #12 — Los mensajes del operador (Modo Humano) no llegan a WhatsApp

**Síntoma**: El operador escribe en el panel pero el lead no recibe el mensaje.

**Causa**: El bot no está corriendo. El outbox loop necesita el proceso del bot activo.

**Solución**: Verificar que `npm run start:all` está en ejecución. Los mensajes en `outbox` con `sent=0` se envían en cuanto el bot reconecte.

---

## #13 — npm install falla con ERR_INVALID_ARG_TYPE

**Síntoma**: `npm install` falla con error de tipo en el reify/rollback.

**Causa**: `node_modules` corrupto (instalación anterior interrumpida).

**Solución**: Borra `node_modules/` completamente y ejecuta `npm install` de nuevo. NO es un problema de dependencias.

---

## #14 — "Module not found: Can't resolve './xxx.js'" en una ruta API

**Síntoma**: `tsc` pasa y los scripts con `tsx` corren bien, pero el server de Next
(Turbopack) devuelve 500 con `Module not found: Can't resolve './phone.js'` al pegarle
a una ruta `/api/*`.

**Causa**: Un archivo de `src/lib/` que importa Next (web bundle) usaba un import relativo
con extensión `.js` apuntando a un archivo `.ts` hermano. `tsx` (el bot) resuelve `.js→.ts`,
pero Turbopack en el bundle web NO hace ese swap. Los `.js` del resto del kit no se notan
porque viven solo en la ruta del bot (`tsx`).

**Solución**: En archivos de `src/lib/` que importe la web (los que llegan desde una ruta
`/api/*`), usar imports **sin extensión** (`from "./phone"`), no `.js`. Es válido con
`moduleResolution: "bundler"` y lo resuelven tanto Turbopack como `tsx`.

---

## #15 — El botón "Generar código QR nuevo" no hace NADA (panel girando para siempre)

**Síntoma** (04-ago-2026, Arteluk y Conejeros a la vez): el panel de Conexión muestra
"Desconectado" y la tarjeta gira eternamente en "Generando código QR…". Apretar el botón
no cambia nada, ni tras recargar ni tras reiniciar el servicio.

**Cómo se midió** (sin credenciales del panel): `GET /api/diag-envio?token=…` devuelve
`connection_state`. El campo `updated_at` llevaba **7 días congelado** en `disconnected`
con `phone: null`. Como `setConnectionState` escribe `updated_at = unixepoch()` en CADA
escritura, un valor congelado prueba que nadie tocó ese estado: ni el bot ni el botón.

**Causa raíz — DOS fallos encadenados:**

1. **El botón moría en el volumen montado.** `/api/connection/disconnect` hacía
   `fs.rmSync(AUTH_DIR, {recursive:true, force:true})`. En producción `auth/` es
   `/app/auth`, un **volumen montado de Docker**: borrar el punto de montaje lanza
   `EBUSY: resource busy`. Esa línea iba **antes** de `fs.writeFileSync(RESTART_FLAG)`,
   así que la excepción abortaba la petición y la señal que vigila el bot **nunca se
   escribía**. La misma línea estaba en `watchRestartFlag()` de `client.ts`, donde el
   EBUSY cae dentro de un `setInterval` y puede tumbar el proceso del bot.
2. **Tras un logout (code 401) el bot se aparca para siempre.** En `client.ts`, la rama
   `DisconnectReason.loggedOut` marca `disconnected` y **no vuelve a llamar a `start()`**,
   que es lo único que emite un QR. Con las credenciales viejas dentro de `auth/`, cada
   reinicio del contenedor da 401 a los ~5 s y se vuelve a aparcar. Medido en vivo tras
   un despliegue: `connecting` → `disconnected` en 5 segundos, y a dormir.

**Solución**: `src/lib/reinicio-qr.ts` — `vaciarAuth()` borra el **contenido** de `auth/`
(nunca la carpeta) y nunca lanza; `pedirReinicioQR()` escribe la señal siempre, aunque la
limpieza falle. Usado por la ruta API y por `watchRestartFlag`. Ya estaba resuelto así en
`whatsapp-monaco` desde el 28-jul-2026; el arreglo nunca se portó aquí.
Test: `npm run test:qr` (7 checks).

**Pendiente**: el punto 2 (que el bot pida QR solo tras un 401) sigue sin arreglar; hoy
la única salida es el botón.

**Cómo reconocerlo**: panel girando en "Generando código QR…" + `updated_at` de
`connection_state` que no se mueve al apretar el botón = la ruta está reventando.

---

## #16 — El CSS moderno que escribes NO llega al navegador (Next lo borra en silencio)

**Síntoma** (09-ago-2026): se añade `height: 100dvh` y `overscroll-behavior-y: contain`
a `globals.css`, el archivo en disco las tiene, el servidor se reinicia… y en el
navegador `getComputedStyle` sigue diciendo `auto`. Ni error, ni aviso, ni nada.

**Cómo se midió**: en la página, `CSS.supports('height','100dvh')` → **true** (el
navegador sí las entiende) y, al inyectarlas a mano con `addStyleTag`, funcionan al
instante. Buscando el texto de todas las hojas de estilo cargadas: `dvh` no aparece por
ningún lado, mientras que la regla vecina del mismo archivo (`column-reverse`) sí.

**Causa raíz**: Lightning CSS, el compilador de CSS de Next, mira la lista de navegadores
objetivo (browserslist) y, como aquí no hay ninguna configurada, usa la de por defecto —
que incluye navegadores anteriores a `dvh` (Safari 15.4) y a `overscroll-behavior`
(Safari 16). Lo que no puede traducir, **lo borra**, sin decirlo.

**Solución** (la que se usó, sin tocar la configuración de todo el proyecto): el valor
viaja dentro de una **variable CSS** —que Lightning CSS no inspecciona— y la regla va
envuelta en `@supports`, que decide el propio navegador:

```css
:root { --alto-visible: 100vh; }
@supports (height: 100dvh) { :root { --alto-visible: 100dvh; } }
.flex.h-screen.overflow-hidden { height: var(--alto-visible); }
```

**Cómo reconocerlo**: una propiedad CSS moderna que "no hace nada" pero que el navegador
sí soporta. Antes de dar vueltas: busca su texto en las hojas cargadas de la página. Si
no está, no es tuyo el error — te lo borró el compilador. Ojo: en desarrollo el CSS llega
por `<style>`, no por `<link>`, así que hay que mirar los dos (y `adoptedStyleSheets`).

**La otra lección del día**: el botón flotante del pincel tapaba el botón de enviar del
chat, y quien lo demostró fue Playwright al negarse a pulsarlo
(`asistente-fab intercepts pointer events`). Un clic automatizado sobre los botones
importantes caza los estorbos de la interfaz que mirando fotos no se ven.
