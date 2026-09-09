# Prompt de trabajo — Limpieza de la app de Mary, optimizada para el teléfono

**Fecha:** 08-09-2026 · **Repo:** `whatsapp-mary` (rama `main`, producción EasyPanel `arteluk`, SIN auto-deploy)
**Origen:** encargo textual de Lukas del 08-09-2026 (9 puntos).

---

## Contexto obligatorio antes de tocar nada

- La app la usa **Mary desde el teléfono** (iPhone). El computador lo usa Lukas.
- El menú vive en `src/lib/menu.ts` (probado con `npm run test:menu`), lo pinta `src/components/AppNav.tsx`
  y en el teléfono se convierte en la **barra de abajo** vía `src/app/globals.css` (`@media max-width:767px`).
- Ya existe el patrón "esconder un botón SOLO en el teléfono": `.app-nav-conexion { display:none }`
  dentro del `@media` (globals.css:124). El QR es cosa del computador.
- El calendario es `src/app/calendario/page.tsx` (943 líneas). Los colores de profesora salen de
  `src/lib/calendario.ts`: **Mary `#00A884` (verde)**, **Paula `#8B5CF6` (morado)**.
- Reglas de la casa: nada de shell-only, no romper lo existente, un cambio = una prueba corrida.

---

## Los 9 encargos, uno por uno

### 1. Fuera "Bot" y "Entrenar IA" del menú
- **Dónde:** `src/lib/menu.ts` (entradas `/ensayo` → "Bot" y `/configuracion` → "Entrenar IA").
- **Cómo:** *(decisión abierta A — ver abajo)*. Si es solo teléfono: **no se toca `menu.ts`**, se
  añaden `.app-nav-ensayo` y `.app-nav-configuracion` al `display:none` del `@media` de globals.css:124.
  Si es en todo: se sacan de `MENU` y **hay que actualizar `scripts/test-menu.ts`**, que hoy custodia
  que "Entrenar IA" tenga puerta (se descubrió el 20-08 que llevaba meses sin botón).
- **Ojo:** las pantallas `/ensayo` y `/configuracion` **siguen vivas y accesibles por URL**. No se borran.

### 2. Fuera el botón "Dictar" del calendario
- **Dónde:** `src/app/calendario/page.tsx:621-624` (`<Mic/> Dictar`, handler `abrirVoz`).
- **Cómo:** se saca el botón. **La API `/api/clases/voz` y el reconocimiento de voz se dejan vivos**
  (mismo criterio que el Asistente: se quita la puerta, no la pantalla). Limpiar imports muertos (`Mic`)
  para que `npm run typecheck` no chille.

### 3. "Formulario" pasa a llamarse "Añadir" y sube arriba
- **Dónde:** `src/app/calendario/page.tsx:625-628` (`<Keyboard/> Formulario`).
- **Cómo:** texto **"Añadir"**, ícono `Plus` en vez de `Keyboard`, y el botón queda **arriba del todo
  del detalle del día**, visible sin hacer scroll y pegado a la fecha. En el teléfono: alto mínimo 44 px.

### 4 y 5. Un solo punto mitad verde / mitad morado, y fuera la línea verde
- **Los puntos de hoy:** `src/app/calendario/page.tsx:588-604` — cada día pinta hasta **3 píldoras**
  (`data-ev`) con fondo `pc.bg` + su punto de 6 px, más el "+N más".
- **Lo que se quiere:** en la celda del mes, **UN solo punto por día**:
  - solo Mary → punto **verde entero** (`#00A884`)
  - solo Paula → punto **morado entero** (`#8B5CF6`)
  - las dos → **punto partido por la mitad**: mitad verde, mitad morado
    (`background: linear-gradient(90deg,#00A884 0 50%,#8B5CF6 50% 100%)`), 8-9 px, centrado bajo el número.
  - día sin nada → sin punto (nada de círculos grises).
- **La "línea verde":** el `borderLeft: 3px solid` de las tarjetas del detalle del día
  (`calendario/page.tsx:639`, `:660`, `:720`). Fuera. El color de la profesora queda **solo en el punto**.
- *(decisión abierta B: si el punto único aplica también al computador o solo al teléfono).*

### 6. Los bloques del día, menos recargados
- **Dónde:** `src/app/calendario/page.tsx:635-680` y `:718-731`.
- **Cómo:** por tarjeta queda **una sola línea de cabecera**: punto de color + hora + nombre de la profe,
  y debajo los alumnos. Se van: la píldora "todas las semanas", la píldora del contador, el borde punteado
  y el doble borde de las clases fijas, y los fondos de color de la tarjeta (fondo blanco, borde `#E7F1EC`).
  Espaciado más aireado: `padding 12px`, `gap 8px`. **No se pierde ninguna información que Mary use hoy**
  (alumnos, hora y quién hace la clase siguen ahí); solo se van los adornos.

### 7. El selector "¿En qué horario?" — ordenado y con colores
- **El bug:** `src/app/calendario/page.tsx:336-346` ordena con `a.dia.localeCompare(b.dia)`, o sea
  **alfabético**: Jueves, Lunes, Martes, Miércoles, Sábado, Viernes. Por eso ve el jueves primero.
- **El arreglo:** ordenar por **el índice de `DIAS`** de `src/lib/calendario.ts`
  (Lunes → Martes → Miércoles → Jueves → Viernes → Sábado) y, dentro del día, **por hora ascendente**.
- **Los colores:** verde los horarios de Mary, morado los de Paula. Un `<option>` con color **no se pinta
  en el Safari del iPhone**, así que el `<select>` de `src/components/FormularioExtras.tsx:145-150`
  se cambia por una **lista de botones/chips** (uno por horario), cada uno con su punto de color a la
  izquierda, agrupados por día, con alto mínimo 44 px. Se mantiene la opción "➕ Crear un horario nuevo"
  y el `horarioId` que ya usa `guardar()`.

### 8. En "buscar alumnos" solo los del CRM
- **El problema real:** el buscador del formulario de clase usa `/api/clientes`
  (`calendario/page.tsx:115` → `listClientes()` en `src/lib/db.ts:2108`), que es la tabla **`clientes`**
  = todos los contactos de WhatsApp. El CRM de alumnos es otra cosa: `/api/alumnos` → `fichasDelMes(mes)`.
- **El arreglo:** el buscador se alimenta de **`/api/alumnos`** (fichas del CRM).
- **⚠ Cuidado con los ids:** `clases.alumnos` guarda hoy ids de la tabla `clientes` y se pintan con
  `nombreCliente(id)` (`:403`). Los ids del CRM son de OTRA tabla: si se guardan tal cual, el calendario
  mostraría nombres cambiados. **Los alumnos del CRM se guardan por NOMBRE (string)**, que es lo que ya
  soporta `etiquetaAlumno` (`:404`) y el POST de `/api/clases` (`alumnos?: (string|number)[]`).
  Las clases viejas con ids numéricos siguen mostrándose igual.
- Se mantiene el orden actual: primero los que vienen ese día, y el buscador por texto.

### 9. Todo optimizado para el teléfono
- Nada por debajo de **44 px** de alto tocable. Sin scroll horizontal. Tipografías ≥ 12 px salvo etiquetas.
- Probar a **390×844 (iPhone 14)** además del computador.

---

## Decisiones abiertas (preguntar ANTES de escribir código)

- **A.** "Bot" y "Entrenar IA": ¿fuera **solo del teléfono** (Lukas los conserva en el computador) o
  **fuera de todo el menú**?
- **B.** El punto único mitad verde/morado: ¿**solo en el teléfono** (en el computador se quedan los
  nombres escritos, que él mismo pidió el 27-08) o **también en el computador**?

## La familia de casos (obligatoria antes de ejecutar)

| Pantalla / caso | ¿Cambia? |
|---|---|
| Calendario en el teléfono | Sí, es el objetivo |
| Calendario en el computador | Solo lo que digan A y B |
| Pantallas `/ensayo` (Bot) y `/configuracion` (Entrenar IA) | **No se tocan**, siguen vivas |
| Dictado por voz `/api/clases/voz` | **No se toca**, solo se esconde el botón |
| Pestaña Alumnos (CRM) | No cambia |
| Aviso de WhatsApp de las 10:00 (usa `bloquesDelDia`) | **No debe cambiar** |
| Clases viejas guardadas con ids | Deben seguir mostrándose igual |

## Cómo se prueba antes de decir "listo"

1. `npm run typecheck` → exit 0.
2. `npm run test:menu`, `npm run test:calendario`, `npm run test:calendario-iphone`,
   `npm run test:calendario-extras`, `npm run test:alumnos`.
3. Levantar la app (`npm run dev`) y **mirar las capturas** a 390×844 y en computador:
   día con solo Mary, día con las dos, día vacío, el selector de horarios y el buscador de alumnos.
4. Pegar la salida real de los tests. Nada de "listo" sin salida.
5. Commit por bloque (menú / calendario visual / selector de horarios / buscador CRM), no al lote.
6. Recordar: **NO hay auto-deploy** — al terminar, avisar que hay que apretar Implementar en EasyPanel.
