# Registro de arreglos — Arteluk / Mary (bot y app de la academia)

> Lista viva de TODO lo que se ha arreglado en este bot, con la fecha, lo que lo prueba y —lo importante— **si volvió a pasar después del arreglo**. Generado el 08-09-2026 a partir de `errores-sesion.md` (46 entradas).

## Para qué existe

Un arreglo anotado en la bitácora dice *qué se hizo*, no *si funcionó*. Este registro añade la única
columna que importa cuando el cliente vuelve a reclamar: **¿ha vuelto a pasar DESPUÉS de la fecha del
arreglo?** Sin esa columna un contador acumulado engaña — dice que el bug existió, no que siga vivo.

**Reglas para mantenerlo** (las mismas que la skill `registro-arreglos`):

1. Al cerrar un arreglo: se anota en `errores-sesion.md` **y** se añade su fila aquí, el mismo día.
2. La columna «¿volvió a pasar?» solo se rellena **midiendo**, con la ventana a la vista
   («0 casos entre el 15-08 y el 08-09»). Sin ventana, se deja `sin medir`.
3. Nunca se mide contra el estado de HOY de un sistema externo (la agenda se mueve, los estados
   cambian): se mide contra un registro escrito **en el momento** (un evento, un log, la tabla propia).
4. `sin medir` es una respuesta legítima y honesta. Inventarse un veredicto no.

## Leyenda de la última columna

| Marca | Qué significa |
|---|---|
| ✅ no volvió | Medido después de la fecha del arreglo: cero casos. Va con su ventana. |
| 🔴 volvió | Medido: hay casos posteriores al arreglo. Va con el último caso. |
| ⚠️ a medias | Bajó mucho pero no a cero. |
| ⏳ sin medir | Nadie lo ha comprobado todavía. No significa que esté bien. |
| 🧩 no medible | No hay registro que lo pruebe (o el instrumento nació después). Se dice por qué. |

## Los 46 arreglos

| # | Fecha | Qué se arregló | Commits | ¿Volvió a pasar? |
|---|---|---|---|---|
| #1 | — | El bot no responde a mis mensajes | — | ⏳ sin medir |
| #2 | — | El QR aparece pero no conecta (código 440) | — | ⏳ sin medir |
| #3 | — | Error 401 (loggedOut) | — | ⏳ sin medir |
| #4 | — | Mensajes perdidos en WhatsApp 2025+ (@lid) | — | ⏳ sin medir |
| #5 | — | SQLITE_BUSY durante `npm run build` | — | ⏳ sin medir |
| #6 | — | Error 405 (versión desactualizada de Baileys) | — | ⏳ sin medir |
| #7 | — | better-sqlite3 falla al instalar en Windows | — | ⏳ sin medir |
| #8 | — | El dashboard muestra conversaciones pero el agente no envía | — | ⏳ sin medir |
| #9 | — | El bot envía respuestas duplicadas | — | ⏳ sin medir |
| #10 | — | El panel web muestra error 500 | — | ⏳ sin medir |
| #11 | — | QR caducado (>60 segundos) | — | ⏳ sin medir |
| #12 | — | Los mensajes del operador (Modo Humano) no llegan a WhatsApp | — | ⏳ sin medir |
| #13 | — | npm install falla con ERR_INVALID_ARG_TYPE | — | ⏳ sin medir |
| #14 | — | "Module not found: Can't resolve './xxx.js'" en una ruta API | — | ⏳ sin medir |
| #15 | — | El botón "Generar código QR nuevo" no hace NADA (panel girando para siempre) | — | ⏳ sin medir |
| #16 | — | El CSS moderno que escribes NO llega al navegador (Next lo borra en silencio) | — | ⏳ sin medir |
| #17 | 09-08-2026 | "Tengo que apretar el botón varias veces" en el iPhone (área táctil de 18x18) | — | ⏳ sin medir |
| #18 | 10-08-2026 | El bot le daba a los apoderados una dirección, una edad y un dato que Mary desmiente | — | ⏳ sin medir |
| #19 | 10-08-2026 | El bot le calcaba a Mary sus propios textos, y escribía como documento | `8131b2e` | ⏳ sin medir |
| #20 | 10-08-2026 | El bot pisaba una regla del prompt cuando la conversación venía larga | `e4971ae` | ⏳ sin medir |
| #21 | 10-08-2026 | Un import con `.js` dejaba la pantalla en 500, con todos los tests en verde | — | ⏳ sin medir |
| #22 | 10-08-2026 | El bot no le contestaba solo a NADIE, ni al lead de un anuncio pagado | — | ⏳ sin medir |
| #23 | 11-08-2026 | La app se quedaba cargando y los botones "no se apretaban" | — | ⏳ sin medir |
| #24 | 11-08-2026 | Apagar dos avisos y encender otros dos: la familia completa antes de tocar | `debad93` | ⏳ sin medir |
| #25 | 11-08-2026 | El chat del inbox no dejaba subir a leer: el scroll se escapaba solo al fondo | — | ⏳ sin medir |
| #26 | 13-08-2026 | Importar algo de `ai.ts` desde `ensayo.ts` rompe el build de Next | — | ⏳ sin medir |
| #27 | 17-08-2026 | El saludo fijo del panel: un atajo así se pasa de goloso si nadie enumera la familia | — | ⏳ sin medir |
| — | 24-08-2026 | Ordenarle al modelo que copie un texto NO garantiza que lo copie | — | ⏳ sin medir |
| — | 24-08-2026 | Un filtro que mira el mensaje suelto, sin saber de qué se venía hablando | — | ⏳ sin medir |
| — | 24-08-2026 | Arreglar el tuteo solo donde se vio, y dejar los otros textos fijos igual | — | ⏳ sin medir |
| — | 26-08-2026 | 08-2026 · Acierto: la planilla mandó sobre el modelo, y lo dudoso se marcó en vez de resolverse | — | ⏳ sin medir |
| — | 26-08-2026 | 08-2026 · Error: un test que borraba alumnos que él no había sembrado | — | ⏳ sin medir |
| — | 26-08-2026 | 08-2026 · El `git push` que se cuelga sin decir nada (no es la red) | `933dfd8` `e83acb8` | ⏳ sin medir |
| — | 26-08-2026 | 08-2026 · Un test que se quedó con la cuenta vieja (`test:alumnos-api`) | `e83acb8` | ⏳ sin medir |
| — | 26-08-2026 | 08-2026 · `git add -A` casi sube datos reales de familias a un repo PÚBLICO | — | ⏳ sin medir |
| — | 27-08-2026 | 08-2026 · Un import con `.js` en `db.ts` tumbó el build entero de Next | — | ⏳ sin medir |
| — | 27-08-2026 | 08-2026 · Un test de pantalla que apretaba el botón de OTRA tarjeta | — | ⏳ sin medir |
| — | 27-08-2026 | 08-2026 · Guardar una hora de clase CERRABA la ficha entera | — | ⏳ sin medir |
| — | 27-08-2026 | 08-2026 · El test miraba UNA etiqueta y dio por bueno un mes entero cortado | — | ⏳ sin medir |
| — | 27-08-2026 | 08-2026 · Un script de Python dejó `SIGUIENTE.md` en CERO bytes (tercera vez) | — | ⏳ sin medir |
| — | 27-08-2026 | 08-2026 · El push que se cuelga: la solución es `GIT_TERMINAL_PROMPT=0` | `95422dd` `f33aea6` | ⏳ sin medir |
| — | 31-08-2026 | 08-2026 · Auditoría de las 40 conversaciones que contestó el bot: 3 fallos, y los 3 estaban "prohibidos" en el prompt | — | ⏳ sin medir |
| — | 01-09-2026 | 09-2026 · "De nuevo el mismo problema de ayer": el veto del saludo solo cazaba la copia calcada | — | ⏳ sin medir |
| — | 08-09-2026 | 09-2026 · El manual describía a otra vendedora (los 5 cambios de estilo) | — | ⏳ sin medir |
| — | 08-09-2026 | 09-2026 (noche) · Lo que solo se ve hablando con el bot de verdad | — | ⏳ sin medir |
| — | 08-09-2026 | 09-2026 (noche) · La limpieza de la app: cuando el test custodia una regla que el dueño ya cambió | — | ⏳ sin medir |

---

_Fuente: `errores-sesion.md` de este repo. Regenerar con la skill `registro-arreglos`._