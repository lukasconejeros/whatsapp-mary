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

---

## #17 — "Tengo que apretar el botón varias veces" en el iPhone (área táctil de 18x18)

**Síntoma** (Lukas, 09-08-2026): *"voy a la pestaña de bot o calendario y se pega, tengo
que apretarlo varias veces o reiniciarla"*. En el iPhone sobre todo, y en las cuatro apps
del mismo molde (Arteluk, Conejeros, Medifis, Anpalex).

**Lo que NO era** (todo descartado midiendo, no opinando): el servidor (180-500 ms de
respuesta), el peso de la app (1 MB de JS), fugas de memoria o de timers (heap clavado en
10 MB tras 50 navegaciones), el volumen de datos (566 conversaciones y 6026 mensajes van
igual de rápido), el service worker y las conexiones SSE (0 handles colgados tras 40).

**Causa raíz**: los botones eran más chicos que el dedo. Medido con un iPhone 13 emulado
en las 9 pantallas del panel: **40 controles por debajo de 44x44**, el mínimo que pide
Apple. Las flechas de mes de Finanzas medían **18x18**, las del Calendario **27x27**, y
los filtros y botones de cabecera andaban en **30-34 px de alto**. Por debajo de 44 el
toque cae fuera del botón y parece que la app no responde.

**Solución**: un bloque en `globals.css` bajo `@media (pointer: coarse), (max-width: 767px)`
que sube a 44x44 el área de `button`, `[role=button]`, `select`, `summary` y los enlaces
con pinta de botón (clase `.boton-tactil`). Sólo crece el área que recibe el toque: ni un
color, ni una tipografía, ni una posición cambian, y en el PC no aplica. Ojo con las
reglas que ya tenían su propio mínimo (`.fin-row .fin-acciones button` estaba en 36 px):
ganan por especificidad, hay que subirlas a mano.

**Cómo se verifica**: `npm run test:botones` (necesita la app levantada y `PANEL_PASSWORD`).
Recorre las 9 pantallas con un iPhone 13 emulado y falla si algún control baja de 44x44 o
si algo lo tapa. Antes del arreglo: 40 fallos. Después: 0, tanto en Chromium como en
WebKit —el motor de Safari, que es el del iPhone de verdad— y contra el build de
producción, no sólo en desarrollo.

**Dos trampas al medir esto**:
1. El panel de herramientas del modo desarrollo (`nextjs-portal`) sale como si tapara los
   botones del menú. No existe en producción: hay que descartarlo o el test miente.
2. Un elemento a medio desplazar dentro de una lista con scroll asoma sólo en parte, y su
   centro geométrico puede caer sobre la barra del menú. Parece "tapado" y no lo está: el
   toque hay que probarlo en el centro de lo que **de verdad se ve**.

**Lo que queda pendiente**: el *"se pega tanto que hay que reiniciarla"* NO se reprodujo
ni con red lenta ni con volumen. Faltan por medir dentro de producción las otras dos
causas encontradas: la ventana muerta entre que la pantalla se ve y responde al dedo
(117 ms aquí, 494 en Medifis) y el pico de 11 peticiones a la vez contra el límite de 6
por dominio que tiene Safari en el iPhone.

---

## #18 — El bot le daba a los apoderados una dirección, una edad y un dato que Mary desmiente

**Síntoma** (10-08-2026): Mary entrenó al bot en la pantalla de práctica haciéndose pasar
por una apoderada (29 preguntas) y corrigió 22 respuestas con "yo diría esto", marcando 7
como "esto yo no lo diría". Al leerlas aparecieron **datos falsos que el bot llevaba
semanas contestando en producción**: la dirección era Picarte 407 y es **Picarte 805,
segundo piso, al lado del Registro Civil**; decía que reciben "desde los 7 años" y es
**desde los 5**; respondía que **NO hacen arteterapia** cuando Mary tiene diplomado en
Arteterapia; e inventaba horarios que no existen.

**Causa**: `prompts/negocio.md` se escribió el 06-08 con los datos de la web y de una
conversación, sin que la dueña los leyera nunca. Nadie los había contrastado con ella.

**La lección que vale para todos los bots del kit**: los datos del negocio los confirma el
dueño ANTES de que el bot atienda a nadie. La pantalla de entrenamiento sirve justo para
eso, pero hay que **leer lo que escribió y bajarlo al prompt**: mientras no se baja, el
entrenamiento no cambia ni una respuesta.

**Cómo se verifica**: `npm run test:cerebro` (47 checks; los nuevos son el candado de cada
dato que ella corrigió: Picarte 805, desde los 5 años, arteterapia sí, recuperar clase,
metodología, monocromáticas, sin becas, forma de pago) y `npm run ensayo:cerebro`, que
corre una conversación completa contra el modelo real y falla si el bot vuelve a dar la
dirección vieja, "desde los 7" o un día de clase.

**Trampa al escribir los checks**: las aserciones de `test:cerebro` buscan texto literal en
el prompt, así que **una negrita en medio de la frase** (`desde los **5 años**`) o un salto
de línea en el punto justo hacen fallar un check que en realidad está bien. Si un check
falla, mirar primero cómo quedó partida la frase en el markdown.

**Trampa al soltar información**: el modelo, con la edad del niño recién dicha, soltaba por
su cuenta el párrafo entero de las técnicas (617 caracteres al tercer mensaje). Prohibirlo
en abstracto no bastó; se arregló **pegando en el prompt el ejemplo exacto de la respuesta
corta** que sí debe dar. Con ejemplo, obedece.

**Lo que quedó pendiente**: los días y horarios están en **tres versiones que no calzan**
(el calendario cargado el 10-08 dice lunes/martes/miércoles; Mary en el entrenamiento dice
niños lunes/martes/jueves y adolescentes viernes/sábado; el prompt viejo decía martes y
jueves). Hasta que ella confirme, el bot **no da ningún día ni hora** y deriva.
