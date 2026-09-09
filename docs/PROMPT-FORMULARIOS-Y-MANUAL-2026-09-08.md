# AUTOPROMPT — Manual del bot (planes + clase de prueba) y Formularios tipo Tally

Encargo de Lukas por audio, 08-09-2026 23:19 Chile. Él dijo: *"no me hagas preguntas solo hazlo todo
lo que te digo, hazte un autoprompt para desarrollarlo todo"*. Este documento ES ese autoprompt.

---

## Los 3 encargos, literales

1. **La clase de prueba, cuando la diga el chatbot, que quede muy bonita.**
2. **Cuando alguien pregunte por una clase en específico, que le dé todos los detalles, los que
   aparecen en la página web igual.**
3. **Formularios**: poder crear un formulario desde el computador, mandárselo a personas (clientes
   nuevos, clientes antiguos) por WhatsApp con un link, que a la persona le aparezca **bonito,
   minimalista y con este look**, sin que se confunda. Referencia a copiar: `https://tally.so/r/nGEA8z`.
   Y que quede **toda una estructura para enviarlo de la manera correcta, sin ningún problema**.

---

## Reglas duras que manda este repo (no negociables)

- **Nada inventado.** Lo que el bot diga sale de `prompts/negocio.md` o de los bloques que edita Mary
  en "Entrenar IA". Si un dato no existe, NO se escribe. (Las **5 salas** que él nombró el 08-09 a las
  23:05 siguen sin decirse cuáles son → se deja un bloque editable vacío, el bot no lo menciona hasta
  que esté lleno.)
- **Anti-baneo, sin excepción.** El envío del formulario NO abre una vía nueva de envío masivo:
  reutiliza la cola `seguimientos` que ya tiene goteo 40–90 s, tope 35/día y ventana 9:00–21:00.
- **Un mensaje = una idea** y **de usted siempre** (auditoría del 08-09).
- **No tocar `src/lib/baileys/`.**
- **Nada está listo sin la prueba corrida y pegada.**

---

## BLOQUE A — Manual del bot (`prompts/negocio.md`)

### A1 · Detalle de cada taller (encargo 2)

Fuente de verdad: `arteluk-web/llms.txt` (lo que ve la persona en la página) cruzado con lo que ya
está en el manual. Se añade una sección nueva **"Si preguntan por UN taller en concreto"** con la
ficha completa de cada uno:

| Taller | Lo que va en la ficha |
|---|---|
| Clase de prueba | 2 horas presenciales · materiales incluidos · acuarela de regalo · sin compromiso · $19.990 (antes $30.000) |
| Acuarela | 3 clases al mes · flora, fauna y retratos · sin matrícula · grupo máx. 6 · $45.000 al mes |
| Artes | 4 clases de 1 hora al mes · materiales base incluidos · grupo máx. 6 · $60.000 + matrícula $15.000 |
| Premium | 4 clases de **2 horas** al mes · zona cowork y sala de espera · grupo máx. 6 · $120.000 + matrícula $15.000 |

Regla: si preguntan por **uno**, va **ese entero** (qué se hace, cuántas clases, cuánto dura,
materiales, tamaño del grupo, precio y matrícula) y **no** se sueltan los otros dos. Si preguntan el
mensual **sin** nombrar uno, siguen yendo los tres cortitos (regla del 08-09, ya vigente).

⚠️ **Contradicción que hay que decirle a Lukas, no resolver solo:** los horarios de la web (Acuarela
martes 16:00–17:00, Artes 18:30–19:30, Premium 17:30–19:30) NO calzan con el bloque de horarios que
Mary confirmó el 10-08 (lunes a sábado). **Los horarios siguen saliendo del bloque de Mary**; a la
ficha del taller solo entra el CONTENIDO (clases, duración, materiales, precio), nunca la hora.

### A2 · La clase de prueba, bonita (encargo 1)

Se reescribe la sección "Cómo hablas de la clase de prueba". Dos modos:

- **Primera vez que la nombra en la conversación** → versión completa, en 3–4 líneas y repartida en
  dos burbujas: para qué sirve (ver su nivel y su personalidad para dejarlo en el grupo que más le
  acomode), 2 horas, todos los materiales incluidos, acuarela de regalo, grupo de máximo 6 con
  acompañamiento cercano, profesoras tituladas, sin compromiso de inscripción, y el precio $19.990.
- **Las veces siguientes** → una línea. Nada de repetir el discurso completo (eso es lo que "marea",
  el reclamo que originó todo esto).

### A3 · Bloque nuevo editable "Nuestro espacio" (las salas)

Nuevo bloque en `secciones-negocio.ts` para que se edite desde **Entrenar IA**, igual que precios y
horarios. **Nace vacío.** Regla en el manual: si está vacío, el bot no habla de salas; si Mary o
Lukas lo llenan (las 5 salas con su propósito y las sensoriales), el bot lo cuenta dentro de la
versión completa de la clase de prueba.

---

## BLOQUE B — Formularios tipo Tally (encargo 3)

### B1 · Qué es la referencia

`tally.so/r/nGEA8z` es un formulario de una sola página, con preguntas de opción múltiple y una
abierta, tipografía grande, sin cajas ni bordes duros, mucho aire, un botón al final. Eso es lo que
se replica, con el verde de Arteluk (`#00A884`) y la Inter que ya usa la app.

### B2 · Base de datos (`src/lib/db.ts`, con `addColumnaSiFalta` para migrar sin romper)

```
formularios(id, slug UNIQUE, titulo, intro, cierre, preguntas TEXT(JSON),
            activo, created_at, updated_at)
formulario_respuestas(id, formulario_id, token, telefono, nombre,
                      respuestas TEXT(JSON), created_at)
formulario_envios(id, formulario_id, token UNIQUE, telefono, nombre,
                  conversation_id, estado, created_at, sent_at, respondido_at)
```

El **token** es la clave de todo: un link distinto por persona (`/f/<slug>?t=<token>`), así se sabe
quién respondió sin pedirle el teléfono, y no se cuentan dos veces.

### B3 · Tipos de pregunta

`texto-corto`, `texto-largo`, `una-opcion`, `varias-opciones`, `escala` (1–5), `si-no`, `email`,
`telefono`. Cada una con `obligatoria` sí/no. Todo se valida **en el servidor**, no solo en el
navegador.

### B4 · Pantallas

- **`/formularios`** (panel, con login, **solo en el computador** — no entra al menú del teléfono,
  que se limpió el 08-09): lista de formularios, crear/editar con vista previa en vivo, copiar link,
  ver respuestas, y el botón de enviar.
- **`/f/<slug>`** (público, sin login): el formulario que ve la persona. Look Tally.
- **`/formularios/<id>/respuestas`**: quién respondió y qué, con el resumen por pregunta.

### B5 · El envío correcto (lo que él llama "la estructura para enviarlo sin problema")

1. Se elige **a quién**: alumnos activos del CRM, clientes antiguos de la libreta, leads nuevos
   (conversaciones abiertas), o marcados a mano.
2. Se escribe el **mensaje que acompaña** (plantilla editable, con `{nombre}`), corto y de usted, y
   se ve la **vista previa exacta** de lo que va a llegar.
3. Se manda **una prueba al teléfono de Lukas o de Mary primero**. Botón aparte, obligatorio antes de
   habilitar el envío masivo.
4. Se encola en `seguimientos` → goteo 40–90 s, tope 35/día, solo 9:00–21:00, y se corta si WhatsApp
   está desconectado. Botón **Detener** que cancela lo pendiente.
5. **Nunca dos veces a la misma persona** para el mismo formulario, y **nunca** a quien ya respondió.

### B6 · Middleware

`/f` y `/api/f` pasan a la lista de públicas. Nada más se abre.

---

## Pruebas obligatorias antes de decir "listo"

| Prueba | Qué custodia |
|---|---|
| `npm run test:formularios` | slug, validación de respuestas, tokens, no-duplicar destinatarios |
| `npm run test:formularios-api` | crear, editar, responder y no poder responder dos veces (app levantada) |
| `npm run test:formulario-publico` | la pantalla pública se ve y se envía (Playwright) |
| `npm run test:secciones` | el bloque nuevo "Nuestro espacio" no rompe Entrenar IA |
| `npm run test:cerebro` + `test:saludo` + `test:antituteo` | el manual nuevo no rompe lo del 08-09 |
| `npm run prueba:estilo` | el modelo REAL obedece las reglas nuevas de planes y clase de prueba |
| `npm run typecheck` + `npm run build` | limpios |

Y la regla del 08-09: **una batería verde no prueba que el modelo obedezca**. `prueba:estilo` se
corre de verdad contra el cerebro.

---

## Lo que queda fuera y hay que decírselo

- **Las 5 salas y las salas sensoriales**: bloque creado y vacío. El bot no las menciona hasta que
  alguien las escriba. No se inventan.
- **Los horarios de la web contra los de Mary**: contradicción real, la zanja él o Mary.
- El deploy: EasyPanel servicio `arteluk` no tiene auto-deploy → hay que apretar Implementar.
