# Diseño — Audio/Fotos, "Cerrado", Seguimiento masivo y look WhatsApp

Fecha: 2026-07-12
Estado: aprobado (diseño), pendiente implementación por fases

## Contexto

App Arteluk (`whatsapp-mary`): panel Next.js 16 + motor Baileys que comparten
`data/messages.db`. Mary conversa desde la app; el bot solo sugiere, ella envía.
Los leads de Meta entran a la categoría `potencial`.

Cinco necesidades reales de Mary, agrupadas en **4 fases independientes** (cada una
se prueba y despliega sola; no se hace todo de una).

## Fase 1 — Arreglar audio + habilitar fotos en el chat

### Problema (audio "llega pero no se escucha / 0:00")
Diagnóstico por lectura de código (`ConversationView.tsx` + `api/send-media`):

1. El cliente graba con `new MediaRecorder(stream)` **sin mimeType explícito** y
   sube el blob con nombre fijo `nota-voz.webm`. En el iPhone de Mary, Safari **no
   soporta webm**: graba `audio/mp4` (AAC) fragmentado.
2. De ese mp4 fragmentado, `ffprobe format=duration` a veces devuelve 0 → el campo
   `seconds` va `undefined` → WhatsApp muestra **0:00**.
3. Si `aOggOpus` (ffmpeg) falla, el fallback manda el audio **crudo**; WhatsApp iOS
   no reproduce webm/mp4 crudo como nota de voz → **"no se escucha"**.
4. El cliente **ya cuenta los segundos** de grabación (`segundos`) pero **no los
   usa** — es la red de seguridad ideal contra el 0:00.

`ffmpeg` SÍ está en `nixpacks.toml` (setup), así que en principio está en producción;
igual se añade una auto-verificación para confirmarlo sin adivinar.

### Solución
- **Extraer** la lógica de audio de la route a `src/lib/audio.ts`
  (`transcodeToVoiceNote`, `duracionSeg`) — aislado y testeable.
- **Cliente:** elegir un `mimeType` soportado con `MediaRecorder.isTypeSupported`
  (Safari → `audio/mp4`, Chrome/Android → `audio/webm;codecs=opus`); nombrar el
  archivo con la extensión correcta; **enviar `segundos` como pista de duración**.
- **Servidor:** `seconds = probe(ogg) || probe(original) || pistaCliente || 0`.
  Nunca 0:00 si el cliente contó bien. Loguear diagnóstico (mime entrante, ffmpeg ok,
  duración, bytes del ogg) para poder ver fallos en los logs de EasyPanel.
- **Fotos:** botón 📷 en `ConversationView` (hoy solo hay micrófono). Reusa
  `api/send-media`, que ya maneja imágenes. Selecciona archivo, sube, inserta en el
  chat y encola en el outbox (kind `image`).
- **Auto-test de producción (temporal):** endpoint que genera un tono con ffmpeg,
  lo transcodifica y prueba la duración → confirma que ffmpeg/ffprobe corren en el
  contenedor. Se elimina tras verificar.

### Verificación
- Test local: genera fuente sintética (mp4 y webm) con ffmpeg, corre
  `transcodeToVoiceNote`, asegura ogg válido con duración > 0.
- `npm run build` verde.
- Prueba real: grabar desde iPhone → llega como nota de voz **que se escucha** con su
  duración; enviar una foto → llega. Sin romper texto.

## Fase 2 — Botón "Cerrado" en leads de Meta

- Campo nuevo `cerrado INTEGER DEFAULT 0` en `conversations` (migración idempotente).
- Botón **"Cerrado"** en `ConversationView`, visible solo en categoría `potencial`.
  Alterna el flag; muestra una etiqueta "Cerrado" y atenúa la conversación.
- Los cerrados **se excluyen** del envío masivo de la Fase 3.
- Verificación: test del toggle en DB + prueba en la app.

## Fase 3 — "Enviar seguimiento" masivo (seguro, personalizado con IA)

### Objetivo
Botón **"Enviar seguimiento"** en la vista Meta. Manda a todos los leads **no
cerrados** un mensaje personalizado invitando a la clase de prueba
(promo $18.000, antes $25.000, invitar a agendar), con el nombre del contacto.

### Anti-baneo (requisito duro)
NO se vuelca todo al outbox de golpe. Cola de campaña separada:
- Tabla nueva `seguimientos` (conversation_id, estado `pendiente|enviado|omitido`,
  mensaje, created_at, sent_at).
- El **bot** (proceso Baileys) drena la cola: **de a uno**, con **pausas aleatorias
  largas** (~40–90 s) y **tope diario** (~35/día). Al tope, espera al día siguiente.
- El mensaje se **redacta con IA por contacto** al momento de enviar (no todos de
  golpe): base la promo + nombre del niño/apoderado (patrón de `api/redactar`).
- Mary ve el **progreso** ("enviados 12 de 40") en la app.

### Verificación
- Test: la cola respeta tope diario y no re-encola cerrados ni duplicados.
- Prueba real: soltar 1–2 seguimientos a un número propio ANTES del masivo; verificar
  redacción y llegada. Recién ahí habilitar el resto.

## Fase 4 — Inbox más como WhatsApp

- Quitar el punto verde "online" de cada avatar (WhatsApp no lo tiene).
- Encabezado más neutro, avatares un poco más grandes, separadores limpios.
- Mostrar ✓✓ / quién mandó el último mensaje en la lista.
- Se propone con captura antes de aplicar. Sin cambios de datos.

## Principios / no-negociables
- No romper el envío de texto/imagen/audio que ya funciona.
- Cada fase: tests donde aplique + build + commit + push + webhook deploy + verificar
  en producción con prueba real. No pasar a la siguiente sin confirmar la anterior.
- No tocar `src/lib/baileys/` salvo el pacing de la cola de campaña (Fase 3), con
  cuidado de no alterar el outbox existente.
- Endpoints de diagnóstico son temporales y se eliminan tras verificar.
