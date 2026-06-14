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
