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

---

## #19 — El bot le calcaba a Mary sus propios textos, y escribía como documento

**10-08-2026, tarde.** Mary volvió a practicar con el bot ya corregido (el #18) y Lukas
cazó dos cosas mirando la conversación: el bot contestaba en párrafos con **dos puntos,
punto y coma y raya larga** (nadie escribe así por WhatsApp), y sobre todo **devolvía
palabra por palabra los textos largos que ella misma había escrito entrenando**. Textual
de Lukas: *"los textos largos que te pase solo es una referencia de la información y cómo
decirlo, no que lo diga exactamente así"*.

**Por qué pasaba**: al bajar el entrenamiento (#18) sus respuestas se pegaron al prompt
**entre comillas y completas**, y el prompt además permitía "un párrafo completo como los
de arriba" cuando preguntaban por el método. Un texto entre comillas dentro del prompt el
modelo lo lee como el molde de la respuesta, no como el dato. La lección: **la información
del negocio se guarda como idea; el ejemplo entre comillas queda solo para las respuestas
que SÍ deben salir textuales** (los datos del banco, la frase de las becas).

**El arnés lo demostró antes de tocar nada**: se endureció primero `ensayo:cerebro` (sin
`:` `;` `—`, techo de 3-4 líneas, y una lista de frases de Mary que no pueden aparecer
calcadas) y la corrida dio **17 fallos**. Después del arreglo, **0**.

**Los 3 bugs que salieron de regalo, ninguno de estilo:**
1. A una niña de 8 le daba **solo lunes y jueves**: martes y miércoles también son de
   niños. El día que se calla puede ser justo el que a esa mamá le acomodaba. (Es otra vez
   la familia de casos: se nombró un día y se olvidaron los hermanos.)
2. Le pedían **los datos para transferir** y respondía pidiendo el nombre primero. Mary en
   su entrenamiento los entrega al tiro.
3. Mary contó que trabajan con una **psicóloga** y ese dato nunca se bajó al prompt. Ahora
   el bot lo cuenta y deriva; el contacto de ella lo entrega Mary, no el bot.

**Excepción que decidió Lukas**: los **horarios** y los **datos para transferir** SÍ van en
líneas separadas, porque en prosa corrida se leen peor. Todo lo demás, corrido.

**Cómo se verifica**: `npm run ensayo:cerebro` (contra el modelo real) y `npm run
test:cerebro` (62 checks). Commit `8131b2e`.
---

## #20 — El bot pisaba una regla del prompt cuando la conversación venía larga (10-08-2026)

**Qué pasó**: con el cerebro del #19 ya desplegado, le pidieron *"¿y me pasas los datos para
transferir?"* y contestó *"primero necesito tu nombre y el de tu hija"*. La regla estaba escrita
y clarísima en el prompt (🚫 no los cambies por nada). El arnés `ensayo:cerebro` seguía en verde.

**Por qué pasaba**: el arnés arranca de cero con un guion de 16 turnos. La pantalla de práctica de
Mary llevaba **66 mensajes**. Con esa conversación encima, el modelo se queda enganchado en lo
último que ofreció ("¿te guardo el cupo?") y esa inercia le gana a una regla del system prompt.
No es que la regla falte: es que no se está mirando en ese momento.

**Lo que lo arregló**: subir la regla al **FILTRO DE ENTRADA**, que el prompt manda evaluar SIEMPRE
antes de responder, en vez de dejarla en el capítulo de datos.

**La lección, que vale para todos los clones del kit**: un arnés que empieza de cero prueba el
prompt, no el bot. Los fallos de verdad aparecen con la conversación encima. Por eso ahora existe
`npm run ensayo:arrastre`, que parte del historial REAL (saneado: el teléfono y el Instagram de la
psicóloga son de una persona de verdad y no van al repo) y repite los turnos que fallaron.
Reprodujo el fallo 2 de 2 veces, con excusa distinta cada vez ("primero el nombre", "primero elige
el horario"): el candado no puede buscar la excusa, tiene que exigir el dato.

**Y lo que NO se tocó**: el otro fallo de esa tanda —contar lo de la psicóloga sin avisarle a
Mary— no se pudo reproducir (derivó 4 de 4 veces, y 6 de 6 después). Se dejó el candado repetido
3 veces por corrida en vez de cambiar el prompt a ciegas. Commit `e4971ae`.

---

## #21 — Un import con `.js` dejaba la pantalla en 500, con todos los tests en verde (10-08-2026)

**Qué pasó**: al portar "Entrenar IA" se creó `src/lib/secciones-negocio.ts` con
`import { getConfig } from "./db.js"`. Los 32 tests pasaban (tsx resuelve `.js` → `.ts`), pero al
abrir la pantalla, **500**: `Module not found: Can't resolve './db.js'`. El bundler de Next no lo
resuelve.

**La lección**: en los módulos de `src/lib` que importa la API de Next, el import va **sin
extensión** — `ensayo.ts` ya lo tenía escrito en un comentario desde hace semanas. Y la de fondo:
esto no lo caza ninguna batería de tests, solo levantar la app y abrir la pantalla de verdad.

**Cómo se verifica**: `npm run build` y, mejor, `npm run dev` + entrar al panel. Commit del port.

---

## #22 — El bot no le contestaba solo a NADIE, ni al lead de un anuncio pagado (10-08-2026)

**Qué pasó**: revisando las bitácoras de Medifis (51 casos) y Anpalex (43) para portar lo aprendido,
apareció algo peor que cualquiera de esos casos. Todas las conversaciones nacen con `mode` en
**HUMAN** (`db.ts`, `DEFAULT 'HUMAN'`) y **ninguna parte del código las encendía**: `setMode` solo se
llamaba desde el panel y desde `silenciar()`. O sea que un lead que llegaba por un anuncio de Meta se
quedaba esperando hasta que Mary abriera el chat y apretara el interruptor a mano.

**Y encima, a quién contestar lo decidía el modelo** leyendo el mensaje (el FILTRO DE ENTRADA del
prompt), teniendo la señal dura de Meta (`ctwa_referral`) guardada en la base desde el primer mensaje
y sin usarla para nada. Es el error #51 de Medifis: allí el modelo metía la plantilla *"Quiero
resolver una duda (anuncio)"* en el saco de los mensajes que no se contestan —corta y sin pregunta— y
se perdían 6 a 8 de cada 14 leads pagados. Aquí la regla escrita es todavía más dura ("ante la duda
real, silencia").

**Lo que se hizo** (decisiones de Lukas, una por una):
- `src/lib/quien-contesta.ts`: **anuncio → contesta siempre · número desconocido → contesta, y el
  filtro del prompt decide · apoderado ya inscrito → callado, lo ve Mary**.
- Columna **`mode_manual`**: si lo decidió una persona, manda. Mary toca el interruptor, o le escribe
  al contacto (desde su teléfono, desde el chat del panel o mandando un audio o una foto) y el bot se
  apaga en esa conversación. El automático ya no vuelve a encenderlo (Medifis #21, Anpalex #20/#25/#26).
- **Fuera el silencio nocturno** de 22:00 a 08:00 (Anpalex #41): el lead que ve el anuncio a las 23:00
  escribe a las 23:00.
- `silenciar()` **se niega** si la conversación llegó por un anuncio, y el motivo de cada chat mudo
  queda en la tabla `mudos` en vez de perderse con el siguiente deploy (Medifis #50).

**Lo que NO se pudo reproducir, y hay que decirlo**: con el arnés contra el modelo real
(`npx tsx scripts/verificar-leads-anuncio.ts 3`) el prompt **viejo** contestó igualmente **15 de 15**
primeros mensajes de anuncio. La regla nueva del prompt es prevención traída de Medifis, no el arreglo
de algo que aquí estuviera midiendo roto. Lo que sí estaba roto de verdad era el modo HUMAN y el
silencio nocturno.

**Cómo se verifica**: `npm run test:quien-contesta` (17), `npm run test:mudos` (11) y, contra el
modelo real, `npx tsx scripts/verificar-leads-anuncio.ts` — 15/15 leads contestados y las 2 frases
personales en silencio, ~USD 0,01 la corrida.

**De paso**: `deleteConversation()` se caía con `FOREIGN KEY constraint failed` en cuanto la
conversación tenía filas hijas nuevas (lo cazó el test), y el `typecheck` del repo estaba **rojo desde
antes** en `ai.ts` (`finish_reason === "end_turn"` imposible y `tool_calls` sin discriminar el tipo).

---

## #23 — La app se quedaba cargando y los botones "no se apretaban" (11-08-2026)

**Síntoma** (Lukas, textual): *"estoy en conversaciones, se queda cargando y aprieto Finanzas o
Calendario y no se aprieta; mi mamá se mete y no carga; pasa en el teléfono y en el computador"*.

**Cómo se midió** (nada de impresiones): Playwright contra producción con pantalla de iPhone
390×844, registrando TODAS las llamadas `/api` con su peso. Antes del arreglo:

| Qué | Medida |
|---|---|
| Fotos de perfil en los primeros 12 s | **104 peticiones · 5,9 MB** · media 4,8 s · la peor **10,2 s** |
| `/api/conversations` | 207 KB **sin comprimir**, ×2 en 12 s |
| Total bajado en 12 s | **6,3 MB en 109 peticiones** |
| Toque en Calendario | **6,1 s** |

**Las tres causas** (ninguna era "el servidor está lento"):

1. **El inbox pedía las 341 fotos de golpe**, también las de las filas que no se ven. El navegador
   solo abre **6 conexiones por dominio**, así que el toque del usuario quedaba EN COLA detrás de
   ~100 fotos → la pantalla no cambiaba y parecía que el botón no respondía.
2. **Las fotos no se cacheaban NUNCA**: la regla `headers()` de `next.config.ts` ponía
   `no-store` a todo lo que no fuera `/_next/static`, y **pisaba** el `Cache-Control` que la
   propia ruta `/api/media` mandaba. Cada apertura de la app volvía a bajar los 5,9 MB enteros.
3. **`/api/conversations` viajaba sin comprimir**: Next comprime el HTML de las páginas pero no
   las respuestas de las rutas `/api`. 207 KB cada 10 s ≈ 1 MB por minuto en datos móviles.

**De paso**: `/api/media` leía el archivo con `readFileSync`, bloqueando el único hilo de Node en
cada foto; con decenas seguidas el servidor no atendía nada más mientras leía del disco.

**Trampa que se evitó**: la nota de la sesión anterior culpaba a `Dashboard.tsx:44` y su
`setInterval` de 2 s. Ese componente **es código muerto** — `/` redirige a `/inbox` y nadie importa
`ConnectionGate`/`Dashboard`. Arreglarlo no habría cambiado nada. Por eso se volvió a medir antes de
tocar en vez de fiarse de lo anotado.

**Cómo se verifica**: correr el script de medida contra producción y comparar con la tabla de
arriba (fotos pedidas en los primeros 5 s, KB totales y tiempo del toque en Calendario). En local:
`/api/conversations` debe responder `content-encoding: gzip`, un `avatar_*.jpg` con
`max-age=86400`, un audio con `max-age=31536000, immutable` y `/inbox` seguir en `no-store`.

## #24 — Apagar dos avisos y encender otros dos: la familia completa antes de tocar (11-08-2026)

**El encargo.** Lukas, por audio: que a las 10:00 le llegue a Mary todo lo del dia y que a
las 21:00 un "microbot" en su propio numero le pregunte si vinieron todos, para pintar el
calendario con puntos verdes y rojos. Textual: *"ya no vamos a hacer lo de las cinco horas"*
y *"no es tanto conversacional, sino tarea especifica"*.

**El acierto (regla de CLAUDE.md aplicada ANTES de escribir codigo).** El pedido nombraba UN
aviso ("el de las cinco horas") pero la app tenia TRES: el resumen de la vispera a las 20:00
por notificacion, el de 5 h antes por notificacion, y los recordatorios que Mary escribe a
mano por WhatsApp. Se le enseño la lista de los tres y se le pregunto que pasaba con cada
uno antes de tocar nada; eligio apagar los dos de notificacion y dejar intactos los suyos.
Sin esa lista se habria apagado solo uno y le habrian quedado cuatro avisos al dia.

**Lo que casi se cuela.** Dos tests nuevos daban por hecho una base vacia: la fecha de prueba
2099-01-05 cae en un dia de semana que SI tiene clases fijas reales (Alison, Amelia...), asi
que los conteos absolutos fallaban. Se cambiaron por diferencias contra el "antes" y por
invariantes (que la lista vaya ordenada), no por totales.

**Un bug propio cazado por un test viejo.** Los chips de alumno con su puntito median 62x26 y
`test:botones` los caza: por debajo de 44x44 no se tocan bien en el iPhone. Se dejo el boton
en 44 px de alto con el chip pequeño dentro, asi el area tactil crece sin engordar el diseño.

**Y una deuda de la misma mañana.** `test:calendario-extras` llevaba roto desde `debad93`
(esta mañana): buscaba un boton "Agregar" que se habia partido en "Dictar" y "Formulario".
Estaba rojo antes de tocar nada; se arreglo de paso.

**Decision de diseño que vale recordar**: el parser de la respuesta NO usa IA. La lista de
nombres del dia se conoce, asi que interpretar "no fue Mateo" es buscarlos en la frase: sale
gratis, responde al instante y **no puede inventar un alumno**. Ante la duda no adivina,
vuelve a preguntar UNA vez y despues lo deja estar.

## #25 — El chat del inbox no dejaba subir a leer: el scroll se escapaba solo al fondo (11-08-2026)

**La queja de Lukas, textual**: *"en la app del compu no puedo ir para arriba con los mensajes
en un chat: al segundo se desliza para abajo solo"*. Pasaba igual en el telefono.

**Causa raiz (con evidencia, no impresion)**: `ConversationView` refresca el chat cada 7 s
(`setInterval` + `setMsgs`) y el `useEffect` del autoscroll dependia de `[msgs]`. Cada
refresco crea un array NUEVO aunque los mensajes sean los mismos, asi que el efecto corria
cada 7 s y mandaba el scroll al fondo. Subir a leer era imposible.

**El arreglo (patron WhatsApp)**: bajar SOLO si cambio el id del ultimo mensaje Y ella estaba
mirando el final (o es la primera carga). Si esta arriba leyendo, ni el refresco ni un mensaje
nuevo la mueven. Lo que ella misma manda (texto, audio, foto) siempre baja a mostrarse:
esos son los 3 puntos de envio y se cubrieron los 3, no solo el del texto.

**La prueba**: `npm run test:chat-scroll` (nuevo, Playwright contra el build real): siembra un
chat de 40 mensajes en la base, sube el scroll, espera un ciclo real de 7 s y comprueba que no
se movio; tambien que un mensaje nuevo no la arrastra estando arriba, y que estando abajo si
baja. Con el codigo viejo fallaban 2 de 6 (el bug reproducido); con el arreglo, 6/6.

**La familia revisada antes de tocar**: el inbox (vivo) = arreglado; Asistente y Ensayo no se
refrescan solos = sin tocar; `ConversationPanel` (Dashboard) tiene el mismo defecto pero es
codigo muerto = sin tocar; y OJO: los paneles de chats de Anpalex/Medifis son codigo hermano
y pueden arrastrar lo mismo — pendiente de revisar en su propia sesion.

**Gotcha de la sesion**: el puerto 3011 estaba ocupado por un `next start` huerfano de una
sesion anterior (levantado 17:33) — el test corria contra un build viejo sin avisar. Antes de
levantar el server de prueba, revisar el puerto y matar el huerfano.

---

## #26 — Importar algo de `ai.ts` desde `ensayo.ts` rompe el build de Next (13-08-2026)

**Que se hizo**: se agrego contabilidad de gasto de IA (tabla `gasto_ia`, `logCostoIA`/
`getGastoIA`), igual a lo que ya tenian Medifis, Anpalex y Conejeros. `ai.ts` (el bot real,
via WhatsApp) y `ensayo.ts` (el chat de practica de Mary) necesitaban las mismas tarifas.

**El error**: poner `tarifaPorModelo` en `ai.ts` e importarla desde `ensayo.ts` con
`import { tarifaPorModelo } from "./ai"` compilaba bien con `tsc` pero **rompia
`npm run build`**: `Module not found: Can't resolve './tools/index.js'`, apuntando a
`ai.ts:3`. Causa: `ai.ts` usa imports con `.js` (`./tools/index.js`, `./db.js`...) porque
solo lo consume el bot via `tsx` (Node ESM real); nunca antes lo habia arrastrado el build
de Next. `ensayo.ts` si lo empaqueta Next (via `/api/ensayo`), y ahi esos imports `.js` no
resuelven. `tsc --noEmit` no lo cazo porque typecheck y el bundler de Next resuelven
distinto.

**La leccion**: antes de importar algo de `ai.ts` en un archivo que toca `src/app/api/`,
comprobar si `ai.ts` ya entraba al build de Next (`grep` por `from ".../lib/ai"` dentro de
`src/app`) — si nunca habia entrado, es señal de que no es seguro arrastrarlo.

**El arreglo**: las tarifas se sacaron a `src/lib/tarifas-ia.ts`, sin ningun import propio,
y las dos partes (`ai.ts` con `.js`, `ensayo.ts` sin extension) lo importan de ahi. `ai.ts`
re-exporta `tarifaPorModelo`/`estimarUSD` para no romper a quien ya las importaba de ahi
(el test). Verificado con `npm run build` limpio despues del cambio.

## #27 — El saludo fijo del panel: un atajo así se pasa de goloso si nadie enumera la familia (17-08-2026)

**Encargo.** Lukas: *"quiero que la app tenga un entrenar ia con toda la info y tambien con el saludo
principal igual que en las app medifis y anpalex"*. Al preguntarle: solo el saludo del primer "hola".

**El acierto (antes de escribir código).** Se listó la familia COMPLETA de primeros mensajes y qué le
pasa a cada uno. Ahí saltaron dos casos que un atajo copiado tal cual de Anpalex se habría llevado
puestos:
- **Mary contesta desde su propio teléfono** (`role: 'human'`). Anpalex solo mira si hay `assistant`
  en el historial; acá eso significaba mandarle la plantilla del bot ENCIMA del saludo que Mary ya
  había escrito a mano. `bienvenidaPara` exige que NO haya ningún mensaje que no sea del usuario.
- **El primer mensaje con foto**: hay que describirla, no saludar. También queda fuera.

**El filtro de entrada NO se salta.** El atajo responde sin pasar por el modelo, así que la duda real
era si se saltaba el silenciador de charla personal. No: el prompt (`negocio.md`, FILTRO DE ENTRADA)
ya manda contestar SIEMPRE el primer mensaje de alguien nuevo. El atajo solo dispara ahí.

**Gotcha de la prueba, no del código.** Probando la API con `curl` desde Git Bash, el saludo llegaba
con las tildes rotas y parecía un bug de la app. Era la consola: mandando el mismo cuerpo desde un
archivo UTF-8 (`--data-binary @body.json`) queda perfecto. Antes de acusar al código, repetir el POST
con un archivo UTF-8.

**Prueba que vale doble.** `npm run test:saludo` llama a `generateReply` DE VERDAD sin clave de
OpenRouter: si contesta, es porque el saludo salió sin tocar el modelo. Un "hola" pelado dejó de
costar plata.

## 28 — Ordenarle al modelo que copie un texto NO garantiza que lo copie (24-08-2026)

**Qué pasó.** El saludo que Mary escribe en "Entrenar IA" viajaba dentro del prompt con la orden
explícita *"dilo con ESAS palabras, no lo reescribas ni le agregues cosas"* (dos veces, líneas 57
y 310 de `prompts/negocio.md`). El modelo igual lo parafraseó en producción: ella escribió
*"hola buenas un gusto… cuéntame cuál es **su** nombre"* y salió *"¡Hola como estai!… cuál es **tu**
nombre"* (conv 365, 12:28) y *"hola como esta!"* (conv 364, 12:22), con la dirección agregada de
su cosecha. Mary entró a corregirlo a mano a las 12:29.

**La lección.** Si un texto tiene que salir palabra por palabra, no puede pasar por el modelo. Se
manda desde el código. La orden en el prompt sirve para el tono, no para la literalidad. Esto ya se
había decidido al revés el 21-08 (se le ofreció a Lukas mandarlo literal y prefirió que lo dijera la
IA "por si encadena con una pregunta"): la salida buena era **las dos cosas** — el texto literal
primero y la IA contestando aparte lo que hayan preguntado.

**De regalo, el origen del "como estai".** Estaba escrito en el propio prompt, en la línea 15, como
EJEMPLO de charla personal que hay que silenciar. El modelo lo leyó como muestra del tono de la
casa. Los ejemplos de un prompt se copian aunque estén puestos para lo contrario: si una frase no
puede salir por WhatsApp, no se escribe en el prompt ni como ejemplo negativo.

## 29 — Un filtro que mira el mensaje suelto, sin saber de qué se venía hablando (24-08-2026)

**Qué pasó.** `quiereLaClaseDePrueba()` apagaba el bot y le pasaba el chat a Mary cuando cazaba
"me interesa" o "me gustaría". Dos personas que solo pedían información quedaron esperando:
conv 364 (*"Me interesa conocer más sobre la academia para mi hija de 8 años"*, 24-08 12:26) y
conv 358 (el botón de Meta *"¡Hola! Me gustaría conseguir más información sobre esto."*,
21-08 15:19). El comentario del propio archivo lo decía sin darse cuenta: *"no hace falta que
nombren la clase de prueba: a esta altura de la conversación es de lo único que se está hablando"*
— esa suposición es verdadera en el mensaje 8 y falsa en el primero.

**La lección.** Cuando una regla depende de "a esta altura de la conversación", el historial es un
argumento de la función, no un supuesto en un comentario. Ahora recibe si el bot o Mary ya habían
nombrado la clase de prueba; nombrarla, pedir hora, inscribir o agendar sigue apagando el bot solo,
sin contexto.

**Y el segundo botón de Meta.** Los anuncios no mandan un solo texto: además del habitual
"¡Hola! Quiero más información" hay uno que dice "¡Hola! Me gustaría conseguir más información
sobre esto.". Cualquier filtro que mire el primer mensaje de un lead tiene que contemplar los dos.

## 30 — Arreglar el tuteo solo donde se vio, y dejar los otros textos fijos igual (24-08-2026)

**Qué pasó.** Por la tarde, al verificar en producción el deploy del antituteo, aparecieron otros
textos que el sistema manda TAL CUAL a los apoderados y que seguían tuteando: la invitación a la
clase de prueba que se les manda a los leads de Meta (*"Me encantaría invitarte… ¿Te gustaría?"*),
el mensaje de después de la clase de prueba (*"Me encantó tenerte… inscribirte"*), el relleno de
`{alumno}` cuando no sabemos el nombre del niño (*"tu hijo/a"*), la frase que sale cuando el modelo
se queda sin respuesta (*"Déjame un momento, vuelvo contigo enseguida"*) y el ejemplo que se le da
al bot al pasarle la conversación a Mary (*"Te paso con una persona del equipo"*), que el modelo
copia palabra por palabra. Los dos primeros estaban así en producción, sin editar (comprobado con
`GET /api/seguimiento`).

**La lección.** El arreglo de la mañana se hizo sobre los textos que se vieron fallando en una
conversación real. "De usted con TODOS, siempre" es una regla sobre una FAMILIA: todos los textos
que escribimos nosotros y que lee un apoderado. Al cerrar una regla así, la lista de la familia se
hace de una (un `grep` de los textos fijos del código) y se mete entera en el test — si no, cada
miembro suelto aparece semanas después, en producción y delante del cliente.

**Lo que no cuenta.** Los textos del chat con Mary (avisos del pase de lista, feedback, ensayo) se
quedan tuteando a propósito: ella no es la apoderada. `src/lib/openrouter.ts` también tutea, pero
es código muerto: no lo importa nadie (verificado con grep en `src/` y `scripts/`).


---

## 26-08-2026 · Acierto: la planilla mandó sobre el modelo, y lo dudoso se marcó en vez de resolverse

**Qué pasó.** Al cargar el horario real de Mary (9 fotos del Excel: 6 días, 2 profesoras, 44 filas)
apareció algo que el modelo de la app no aguantaba: **dentro de la misma sala cada alumno tiene su
propia hora de salida** — el jueves Barbara se queda hasta las 19:30 y los otros cuatro se van a las
18:30. Con `clases_fijas` (un bloque = una hora = una lista de nombres) había que partir cada día en
dos o tres "clases" que no existen. Se cambió el modelo (`alumnos` + `inscripciones` con `hora_fin`
por alumno) en vez de deformar los datos para que cupieran.

**Lo segundo, que es la lección de verdad.** La planilla venía con seis ambigüedades: una foto sin
encabezado (no se sabe qué día es), un bloque sin profesora, un alumno repetido en las dos tablas del
sábado a la misma hora, y seis nombres que pueden ser una persona o dos (Amelia / Amelia
Brellenthin, Julieta Bratz / Julieta…). La tentación era resolverlas por parecido de nombre. **Son
menores**: pegarle el teléfono equivocado a una ficha es escribirle al apoderado de otro niño. Se
cargaron igual (no se pierde a nadie) pero **marcadas en `revisar`**: 23 de las 41 fichas salen en
amarillo en la pantalla hasta que Mary las confirme, y el apoderado solo se pegó donde la
coincidencia era exacta y única — 21 de 41.

**La regla.** Cuando el dato de entrada es ambiguo, la respuesta no es adivinar ni descartar: es
cargar y marcar, con la duda escrita en la ficha para que la persona que sabe la resuelva en un
toque. Y el número de dudas se muestra arriba (`23 por confirmar con Mary`), porque una marca que
nadie ve es una marca que nadie resuelve.

---

## 26-08-2026 · Error: un test que borraba alumnos que él no había sembrado

**Qué pasó.** Al terminar el botón "no viene" se corrió la batería y `test:horario` daba
**52 pasaron, 5 fallaron**… y al correrlo solo, 57/57. La intermitencia tenía causa: el test siembra
los 41 alumnos de la planilla, comprueba que la carga los crea, y al final **borra por NOMBRE todos
los alumnos del plan**. Si la base ya los tenía cargados (por ejemplo porque se arrancó la app
antes, que los siembra sola), la carga no creaba a nadie ⇒ 5 checks en rojo, y encima **el test
borraba a los 41 alumnos que no había sembrado él**.

**Por qué importa aunque sea "solo un test".** Es el mismo error del 04-08 con los tests de voz: un
test es código con alcance. Si esa base hubiera sido la de Mary, la limpieza le habría borrado el
horario completo.

**El arreglo.** Antes de sembrar, el test mira si el horario ya está cargado (`yaCargado`); si lo
está, **se salta enteras las partes 2 y 3** y lo dice en pantalla ("la base ya tiene el horario
cargado"). Así nunca borra lo que no creó, y un 42/42 honesto reemplaza a un 52/5 que asustaba sin
que nada estuviera roto.

**La regla.** Un test que siembra en una base compartida tiene que poder responder dos preguntas
antes de limpiar: ¿esto lo creé yo?, ¿y si ya estaba? Si no puede, no borra: se salta.
