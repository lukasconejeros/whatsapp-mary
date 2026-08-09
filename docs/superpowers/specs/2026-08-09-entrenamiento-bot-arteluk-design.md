# La tarde de entrenamiento de Mary

**Fecha**: 09-08-2026 · **Estado**: diseño aprobado por Lukas, sin implementar

## Qué se quiere

Que Mary entrene al bot **ella sola, en una tarde**, sin nosotros al lado: conversa con él en la
pantalla de práctica, corrige cada respuesta que no le gusta ("yo diría esto"), y graba audios con
su propia voz para las preguntas que no se contestan bien por escrito (una foto que no se entiende,
los valores, un niño con autismo).

Todo lo de esa tarde queda guardado **sin que ella pueda perderlo**. Después nosotros lo leemos
entero y con eso armamos el cerebro definitivo del bot.

Palabras de Lukas: *"que quede todo guardado en el chat, que lo haga en una tarde, cosa de que no se
vaya a eliminar ni nada, y que nosotros vengamos y digamos: ya, ¿qué conversó con mi mamá, qué audio
grabó?"*

## Las tres decisiones que tomó Lukas (09-08-2026)

1. **Los audios el bot los PROPONE, no los manda solo.** Cuando la situación calza, el bot deriva a
   Mary con el audio ya elegido y **ella aprieta enviar**. Es su voz real: si el bot se equivoca de
   momento, un apoderado escucha a Mary diciendo algo que no venía al caso.
2. **Las correcciones quedan anotadas; el cerebro NO cambia solo.** Las aplicamos nosotros después de
   leerlas. Nada se modifica sin que lo veamos.
3. **Los audios se graban con el micrófono, dentro de la app, desde el teléfono.** Aprieta y habla,
   como una nota de voz. Sin pasos intermedios ni archivos que se pierdan.

## Lo que YA existe (no se construye de nuevo)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Envío de notas de voz | `src/lib/baileys/outbox.ts:90` | `{ audio, ptt: true, ogg/opus }` + plan B si falla |
| Conversión a nota de voz | `src/lib/audio.ts` (`prepararNotaVoz`) | deja el audio como el de WhatsApp, con su duración |
| Recepción de fotos y audios | `src/lib/baileys/handler.ts:92-100` | detecta el caso "me mandan una foto y no entienden" |
| Pantalla de práctica | `src/app/ensayo/page.tsx` + `/api/ensayo` | el chat donde Mary conversa con el bot |
| "Esto yo no lo diría" | `ensayo_mensajes.malo` (`db.ts:226`) | el pulgar abajo, ya funciona |
| Derivar a Mary | tool `derivarHumano` | el camino por donde viajará la propuesta de audio |

## Lo que hay que cambiar o construir

### 1. La tarde no se puede borrar (lo primero, es el mayor riesgo)

**Hoy `limpiarEnsayo()` hace `DELETE FROM ensayo_mensajes` (`db.ts:1336`): borra todo.** Si Mary
entrena cuatro horas y aprieta "Empezar de nuevo", pierde la tarde entera.

- Se añade `sesion_id INTEGER` a `ensayo_mensajes`.
- "Empezar de nuevo" **archiva**: sube el `sesion_id` y deja la pantalla limpia. **No borra ni una fila.**
- El `DELETE /api/ensayo` deja de borrar mensajes; solo cambia de sesión.
- Migración: las filas que ya existen quedan en `sesion_id = 1`.

### 2. "Yo diría esto"

- Columnas nuevas en `ensayo_mensajes`: `correccion TEXT` y `correccion_audio TEXT` (nombre de archivo).
- Debajo de cada respuesta del bot: un cuadro para escribir su versión **o grabarla hablando**.
- La corrección queda pegada a la respuesta que corrige (por `id`), para que después se entienda
  qué estaba mal.
- Marcar "esto yo no lo diría" sigue existiendo y es independiente: puede marcar sin escribir nada.

### 3. Sus audios guardados

Tabla nueva `audios_mary`:

| Campo | Para qué |
|---|---|
| `id` | — |
| `archivo` | nombre en `data/media` |
| `titulo` | cómo lo llama ella ("el del autismo") |
| `cuando_usarlo` | **en sus palabras**: "cuando preguntan por niños con autismo" |
| `segundos` | duración |
| `created_at` | — |

Pantalla "Mis audios" dentro de la pestaña Bot: grabar (micrófono del navegador), escuchar,
renombrar, cambiar el "cuándo usarlo", borrar.

El `cuando_usarlo` escrito por ella **es el material con el que después configuramos al bot**: es
ella diciéndonos en qué situación va cada audio.

### 4. Cómo los usa el bot

- **Cómo elige el audio**: se le entrega al modelo una tool nueva, `proponerAudio`, cuya descripción
  lleva la lista de audios con el `cuando_usarlo` **tal como lo escribió Mary**. El modelo solo puede
  elegir un `id` de esa lista: no inventa audios ni situaciones. Si ella no ha grabado ninguno, la
  tool no se ofrece.
- En la práctica, cuando el modelo llama a `proponerAudio`, el bot **no lo manda**: muestra
  *"aquí te habría propuesto mandarle este audio: ⟨título⟩"*, igual que hoy muestra las demás
  herramientas simuladas (`simularHerramienta`).
- En WhatsApp de verdad (más adelante, cuando el bot esté encendido) el mismo camino termina en
  `derivarHumano` con el audio propuesto, y Mary aprieta enviar.
- **Ninguna herramienta se ejecuta de verdad durante la práctica.** Esto ya es así y no cambia.

### 5. Lo que vemos nosotros después

Un botón **"Descargar todo"** que saca la tarde completa en un archivo legible:
cada pregunta, cada respuesta del bot, cada corrección de Mary (texto y audio), y la lista de audios
con su "cuándo usarlo". Es lo que leemos para armar el cerebro definitivo.

## Verificación obligatoria ANTES de implementar

**Que `data/` sea un volumen persistente en EasyPanel.** Si no lo es, los audios de Mary se borran
solos en el próximo despliegue — exactamente lo que Lukas no quiere. Está confirmado que `/app/auth`
sí es volumen montado (`errores-sesion.md:175`) y la base de conversaciones sobrevive a los deploys,
pero **hay que verlo en el panel de EasyPanel antes de escribir código**, no darlo por hecho.

## Qué NO se hace (a propósito)

- El bot **no manda audios solo**. Decisión de Lukas.
- El cerebro **no se reentrena solo** con las correcciones.
- No se toca el bot de WhatsApp de verdad: esto vive entero en la pestaña Bot.
- No se transcriben los audios de Mary. Si hace falta, es otro trabajo.

## Cómo se prueba

- **Que no se pierda nada**: entrenar, apretar "Empezar de nuevo", y comprobar en la base que las
  filas viejas **siguen ahí** con su `sesion_id` anterior. Es el test que más importa.
- **Corrección**: guardar texto y audio sobre una respuesta y leerlos de vuelta pegados a su `id`.
- **Audios**: grabar, escuchar y que `prepararNotaVoz` los deje como nota de voz con su duración.
- **Propuesta de audio**: que en la práctica aparezca el aviso y que **no se envíe nada**.
- **Descargar todo**: que salga la tarde entera, correcciones y audios incluidos.
- Y probarlo **por HTTP contra el panel andando**, no solo con tests: una batería verde no basta.
