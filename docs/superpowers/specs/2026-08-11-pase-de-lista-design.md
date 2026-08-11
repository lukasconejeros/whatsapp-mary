# Aviso de las 10:00 y pase de lista de las 21:00 — diseño

Fecha: 11-08-2026 · Pedido de Lukas (audio, 15:35) · Aprobado por él el mismo día.

## Qué pide

Dos mensajes fijos al día por WhatsApp, al chat que Mary tiene consigo misma (el
número del propio bot, +56963554778), y que el de la noche **acepte respuesta**:

1. **10:00** — todo lo que tiene ese día.
2. **21:00** — *"Hoy tenías a Mateo, Matilda y Sofía. ¿Vinieron todos?"*. Ella
   contesta y la respuesta pinta el calendario: **punto verde** el que vino,
   **punto rojo** el que faltó. Abajo del calendario, una sección con los que
   faltaron y qué día.

Textual suyo: *"no es tanto conversacional, sino tarea específica"* ⇒ no es el bot
de ventas hablando: es un micro-flujo cerrado con la lista de nombres de ese día.

## Decisiones tomadas con él (11-08, con opciones sobre la mesa)

| Pregunta | Elegido |
|---|---|
| Qué pasa con los avisos que ya existen | **Se apagan los dos**: el resumen de la víspera (20:00) y el aviso de 5 h antes |
| Por dónde llegan los nuevos | **WhatsApp al propio número**, no push |
| Días sin nadie agendado | **Se calla** (ni el de las 10:00 ni el pase de lista) |
| Periodo de la lista de ausencias | **El mes que está viendo** en el calendario |

Decisiones mías, dichas y aceptadas: el parser NO usa IA (más barato y no
alucina nombres), el aviso de las 10:00 incluye los pagos fijos que caen ese día,
y si no contesta no se le insiste.

## La familia completa de avisos (antes → después)

Regla dura de CLAUDE.md: nombrar a TODOS los hermanos antes de tocar uno.

| Aviso | Hoy | Después |
|---|---|---|
| Resumen de la víspera, 20:00 (Web Push) | activo | **apagado** |
| 5 h antes de cada clase (Web Push) | activo | **apagado** |
| Recordatorios que Mary escribe en el formulario (WhatsApp) | activo | **intacto** |
| Resumen del día, 10:00 (WhatsApp) | no existe | **nace** |
| Pase de lista, 21:00 (WhatsApp) | no existe | **nace** |

Los dos que se apagan viven en `src/lib/recordatorios.ts`
(`recordatoriosPendientes`) y los consume `recordatorios-loop.ts`. Se apagan
**dejando el código y sus tests**, detrás de una constante `AVISOS_PUSH_ACTIVOS =
false`, para poder devolverlos sin reescribirlos si él cambia de idea.

## Arquitectura

Tres piezas nuevas, cada una con un solo trabajo, siguiendo el patrón que ya usa
el repo (lógica pura sin reloj ni I/O + un loop que la ejecuta):

- **`src/lib/avisos-mary.ts`** (puro) — dado hoy, la hora, las clases del día y
  lo ya enviado, dice qué mensaje toca mandar ahora: `resumen` (10:00),
  `pase-lista` (21:00) o nada. Ventana de gracia de 180 min, igual que los
  recordatorios (cubre que el bot estuviera caído). Fuera de la ventana no se
  manda: un pase de lista a las 2 de la mañana es ruido.
- **`src/lib/pase-lista.ts`** (puro) — el parser. Entra el texto de Mary + la
  lista CERRADA de nombres que se le preguntaron; sale quién vino, quién faltó,
  o "no entendí".
- **`src/lib/avisos-mary-loop.ts`** — el que toca la base y el outbox. Se engancha
  a la pasada de 5 min que ya corre `recordatorios-wa-loop.ts`.

Y en el handler de WhatsApp, una rama nueva antes de la lógica normal: si el
mensaje viene del **propio número del bot** y hay un pase de lista esperando
respuesta hoy, lo procesa el micro-flujo y **no** entra al bot conversacional.

### Por qué se puede leer lo que Mary contesta

Cuando ella escribe en su chat consigo misma, WhatsApp entrega el mensaje con
`key.fromMe = true`. El handler ya trata ese caso (`handler.ts:185-220`): hoy lo
guarda como `human` y apaga el bot en esa conversación, pero nadie interpreta el
texto. Se le añade el desvío. Los audios ya se transcriben antes
(`procesarMedia`), así que ella puede contestar hablando sin tocar nada más.

## Datos

```sql
-- Un aviso automático por día y tipo. Existe para NO repetir el mensaje en cada
-- pasada de 5 min, y para el candado del outbox (enviado_at solo cuando WhatsApp
-- confirma; el "enviado" falso ya costó un incidente en la app de Lukas).
CREATE TABLE IF NOT EXISTS avisos_diarios (
  fecha TEXT NOT NULL,            -- 'YYYY-MM-DD'
  tipo TEXT NOT NULL,             -- 'resumen' | 'pase-lista'
  outbox_id INTEGER,              -- en la cola, aún sin confirmar
  enviado_at INTEGER,             -- confirmado por el outbox
  PRIMARY KEY (fecha, tipo)
);

-- Lo específico del pase de lista: a quién se preguntó (lista cerrada) y qué
-- contestó. 'aclaraciones' cuenta cuántas veces se le pidió que repita: máximo 1.
CREATE TABLE IF NOT EXISTS pase_lista (
  fecha TEXT PRIMARY KEY,
  alumnos TEXT NOT NULL,          -- JSON: ["Mateo","Matilda"]
  respondido_at INTEGER,
  respuesta TEXT,                 -- lo que escribió/dijo, tal cual
  aclaraciones INTEGER NOT NULL DEFAULT 0
);

-- Quién vino y quién no. Una fila por alumno y día.
CREATE TABLE IF NOT EXISTS asistencia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  alumno TEXT NOT NULL,           -- el nombre tal cual se le mostró
  estado TEXT NOT NULL CHECK(estado IN ('vino','falto')),
  fuente TEXT NOT NULL DEFAULT 'whatsapp',   -- 'whatsapp' | 'panel'
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (fecha, alumno)
);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);
```

**Por qué la asistencia va por nombre y no por clase**: un día de Mary son clases
fijas (`clases_fijas.alumnos` = nombres en texto) más eventos puntuales
(`clases.alumnos` = ids de `clientes` o texto suelto). Los dos mundos solo tienen
en común el **nombre visible**, que es además lo que ella dice por WhatsApp
("no fue Mateo"). Si el mismo niño aparece en dos clases del mismo día, se le
pregunta una vez y el punto sale en las dos: es lo que ella espera.

## Los dos mensajes

**10:00 — resumen del día.** Se arma con lo mismo que muestra el calendario:
clases fijas del día + eventos puntuales + recordatorios suyos de esa fecha +
pagos fijos que caen ese día. Ordenado por hora. Si no hay NADA, no se manda.

```
☀️ Hoy martes 12
16:00 Mary · Mateo, Matilda
18:00 Paula · Sofía, Tomás
⏰ Llamar a la mamá de Sofía
💸 Hoy toca el arriendo ($350.000)
```

**21:00 — pase de lista.** Solo si el día tuvo alumnos.

```
📋 Hoy tenías a Mateo, Matilda, Sofía y Tomás.
¿Vinieron todos? Si faltó alguien dime su nombre.
```

Respuestas y qué hace:

| Ella dice | Resultado |
|---|---|
| "sí" / "todos" / "vinieron todos" / "sip" | los 4 → **vino** |
| "no fue Mateo" / "faltó Mateo" / "todos menos Mateo" | Mateo → **faltó**, el resto → **vino** |
| "faltaron Mateo y Sofía" | esos dos → **faltó**, el resto → **vino** |
| "no vino nadie" / "ninguno" | los 4 → **faltó** |
| cualquier otra cosa | responde *"Perdona, no te entendí. Dime solo los nombres de los que faltaron, o escribe «todos» si vinieron todos."* y espera |

Reglas del parser (`pase-lista.ts`), todas sobre la lista cerrada del día:

- Compara sin tildes ni mayúsculas, y acepta el nombre suelto ("mateo" encuentra
  a "Mateo Pérez"). Un nombre que no está en la lista del día **se ignora**: no
  se inventa un alumno.
- Si hay nombres pero ninguna palabra de negación (`no vino`, `no fue`, `faltó`,
  `faltaron`, `menos`, `no llegó`), la frase es ambigua ("vino solo Mateo") ⇒
  **pide aclaración**, no adivina. Marcar mal a un niño es peor que preguntar.
- Máximo **una** aclaración. Si la segunda tampoco se entiende, el día queda sin
  marcar y le dice que lo marque en el calendario. No insiste más.
- La respuesta se acepta hasta el **día siguiente a las 12:00**; después, ese
  texto ya no se toma como pase de lista (es otra conversación).

## Calendario

- En la vista del día, junto a cada alumno un **puntito**: verde = vino, rojo =
  faltó, gris = sin marcar. Tocarlo cambia entre los tres estados y guarda con
  `fuente = 'panel'` (así ella corrige lo que el parser entendió mal).
- Debajo, sección **"Faltaron este mes"**: nombre + días, ordenada por quién
  falta más. Se calcula del mes que está viendo, no del historial completo.
- Datos por `GET /api/asistencia?desde=&hasta=` y `POST /api/asistencia`
  (`{fecha, alumno, estado}`), con la misma autenticación que el resto del panel.

## Errores y bordes

- **WhatsApp caído a las 10:00 o 21:00**: no se encola nada; la ventana de gracia
  de 3 h reintenta en las pasadas siguientes. Pasada la ventana, ese día no sale
  (mejor callarse que avisar a deshora).
- **El envío falla en el outbox**: `enviado_at` se queda en nulo y la fila se
  suelta para reintentar, igual que los recordatorios de Mary. Nunca se da por
  enviado lo que WhatsApp no confirmó.
- **Ella responde antes de que llegue la pregunta** (o cualquier otro día): sin
  pase de lista abierto, el mensaje sigue el camino de siempre y se guarda como
  suyo. Nada cambia.
- **Un alumno se agrega a la clase después de las 21:00**: el pase de lista de
  ese día ya se preguntó con la lista vieja; el nuevo queda sin marcar y ella lo
  marca en el panel.
- **Domingo y días sin clases**: ni resumen ni pase de lista.

## Pruebas

- `pase-lista.ts`: batería con las frases reales de la tabla de arriba, más las
  trampas (nombre que no existe, frase ambigua, dos nombres, "nadie", vacío).
- `avisos-mary.ts`: 09:59 no manda, 10:00 sí, 12:59 sí (gracia), 13:01 no; lo
  mismo a las 21:00; día vacío no manda; ya enviado no repite.
- Punta a punta contra la base real (como `test-recordatorios-wa.ts`): se
  encola, se confirma, se responde "no fue Mateo" y queda la fila de asistencia.
- Y lo de siempre: `typecheck`, `build`, y las 15 baterías del repo verdes antes
  de decir que está listo.
