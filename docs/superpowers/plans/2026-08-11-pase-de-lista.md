# Aviso de las 10:00 y pase de lista de las 21:00 — plan de implementación

> **Para quien ejecute esto:** usar `superpowers:executing-plans`. Los pasos van con casilla (`- [ ]`).

**Goal:** que a las 10:00 le llegue a Mary por WhatsApp todo lo del día, y a las 21:00 un pase de lista que ella contesta y que pinta el calendario con puntos verdes y rojos.

**Architecture:** el patrón que ya usa el repo — lógica pura sin reloj ni I/O (`avisos-mary.ts`, `pase-lista.ts`, probables al segundo) + un loop que toca la base y encola en el outbox (`avisos-mary-loop.ts`), enganchado a la pasada de 5 min que ya existe en `recordatorios-loop.ts`. La respuesta de Mary entra por el handler de WhatsApp, en una rama nueva para los mensajes de su propio número.

**Tech Stack:** TypeScript, Next 16, better-sqlite3, Baileys 7, tsx para los tests (cada test es un script con `check()`, no hay framework).

**Spec:** `docs/superpowers/specs/2026-08-11-pase-de-lista-design.md`

## Global Constraints

- **Nada de shell-only** (`cp`, `rm`, `&&` de bash): el repo corre en Windows.
- **`enviado_at` NUNCA se escribe al encolar**, solo cuando el outbox confirma. El "enviado" falso ya costó un incidente.
- Ventana de gracia: **180 min** desde la hora del aviso, igual que `recordatorios-wa.ts`.
- Hora y fecha SIEMPRE de `todaySantiago()` / `nowSantiago()`, nunca `new Date()` suelto.
- Los textos que le llegan a Mary van **en chileno, cortos y sin jerga**.
- Cada tarea termina con `npm run typecheck` en verde antes del commit.
- No tocar `src/lib/baileys/` más allá de la rama nueva del handler descrita en la Tarea 5.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/db.ts` (modificar) | 3 tablas nuevas + sus funciones de acceso |
| `src/lib/dia-de-mary.ts` (crear) | junta lo del día: clases fijas + eventos + recordatorios + pagos, y la lista de alumnos |
| `src/lib/avisos-mary.ts` (crear) | puro: a qué hora toca cada aviso y cómo se redacta |
| `src/lib/pase-lista.ts` (crear) | puro: interpreta la respuesta de Mary contra la lista cerrada de nombres |
| `src/lib/avisos-mary-loop.ts` (crear) | encola en el outbox, confirma, y procesa la respuesta |
| `src/lib/recordatorios-loop.ts` (modificar) | apaga los 2 push viejos y llama al tick nuevo |
| `src/lib/baileys/handler.ts` (modificar) | desvía el mensaje del propio número al pase de lista |
| `src/app/api/asistencia/route.ts` (crear) | GET por rango, POST para marcar a mano |
| `src/app/calendario/page.tsx` (modificar) | puntitos por alumno + sección "Faltaron este mes" |

---

### Task 1: Las tres tablas y su acceso

**Files:**
- Modify: `src/lib/db.ts` (SCHEMA ~línea 253, funciones al final)
- Create: `scripts/test-asistencia-db.ts`
- Modify: `package.json` (script `test:asistencia`)

**Interfaces — Produces:**
```ts
export interface AvisoDiario { fecha: string; tipo: 'resumen' | 'pase-lista'; outboxId: number | null; enviadoAt: number | null }
export function getAvisoDiario(fecha: string, tipo: string): AvisoDiario | null
export function marcarAvisoEncolado(fecha: string, tipo: string, outboxId: number | null): void
export function marcarAvisoEnviado(fecha: string, tipo: string): void

export interface PaseLista { fecha: string; alumnos: string[]; respondidoAt: number | null; respuesta: string | null; aclaraciones: number }
export function getPaseLista(fecha: string): PaseLista | null
export function abrirPaseLista(fecha: string, alumnos: string[]): void
export function cerrarPaseLista(fecha: string, respuesta: string): void
export function sumarAclaracion(fecha: string): number   // devuelve el total tras sumar

export interface Asistencia { id: number; fecha: string; alumno: string; estado: 'vino' | 'falto'; fuente: 'whatsapp' | 'panel' }
export function marcarAsistencia(fecha: string, alumno: string, estado: 'vino' | 'falto', fuente?: 'whatsapp' | 'panel'): void
export function asistenciaRango(desde: string, hasta: string): Asistencia[]
export function borrarAsistencia(fecha: string, alumno: string): void
```

- [ ] **Step 1: escribir el test que falla** — `scripts/test-asistencia-db.ts`, con el estilo de `scripts/test-recordatorios-envio.ts` (`check(nombre, condicion)` y contador `pass/fail`). Casos:
  - abrir un pase de lista guarda los alumnos y `respondidoAt` en null
  - `marcarAsistencia` dos veces con el mismo alumno y día **actualiza**, no duplica (UNIQUE)
  - `asistenciaRango` devuelve solo lo del rango pedido
  - `marcarAvisoEncolado` deja `enviadoAt` en null; `marcarAvisoEnviado` lo llena
  - `sumarAclaracion` devuelve 1 y luego 2
  - limpieza al final: borra lo que creó (fechas de prueba `2099-01-0X`)
- [ ] **Step 2: correrlo y ver que falla** — `npm run test:asistencia` → error de import (funciones inexistentes)
- [ ] **Step 3: implementar** — añadir al SCHEMA las 3 tablas tal cual el spec (`avisos_diarios`, `pase_lista`, `asistencia`) y las funciones de arriba. Van juntas al final de `db.ts`, bajo un encabezado `// ── Avisos diarios y pase de lista ──`. `marcarAsistencia` usa `INSERT ... ON CONFLICT(fecha, alumno) DO UPDATE SET estado=excluded.estado, fuente=excluded.fuente`.
- [ ] **Step 4: correr y ver verde** — `npm run test:asistencia` y `npm run test:db` (que no se rompa lo existente) + `npm run typecheck`
- [ ] **Step 5: commit** — `feat(db): las tablas del pase de lista y la asistencia`

---

### Task 2: El parser de la respuesta

**Files:**
- Create: `src/lib/pase-lista.ts`
- Create: `scripts/test-pase-lista.ts`
- Modify: `package.json` (`test:pase-lista`)

**Interfaces — Produces:**
```ts
export type Lectura =
  | { tipo: 'ok'; vino: string[]; falto: string[] }
  | { tipo: 'no-entendi' };
export function interpretarPaseLista(texto: string, alumnos: string[]): Lectura
export function normalizar(s: string): string   // minúsculas, sin tildes, sin puntuación
```

- [ ] **Step 1: escribir el test que falla** con estos casos, sobre `['Mateo','Matilda','Sofía','Tomás']`:

```ts
igual("todos vinieron", interpretarPaseLista("sí", A), { tipo:'ok', vino: A, falto: [] });
igual("todos", interpretarPaseLista("vinieron todos", A), { tipo:'ok', vino: A, falto: [] });
igual("faltó uno", interpretarPaseLista("no fue Mateo", A), { tipo:'ok', vino:['Matilda','Sofía','Tomás'], falto:['Mateo'] });
igual("faltaron dos", interpretarPaseLista("faltaron Mateo y Sofia", A), { tipo:'ok', vino:['Matilda','Tomás'], falto:['Mateo','Sofía'] });
igual("todos menos", interpretarPaseLista("todos menos Tomás", A), { tipo:'ok', vino:['Mateo','Matilda','Sofía'], falto:['Tomás'] });
igual("no vino nadie", interpretarPaseLista("no vino nadie", A), { tipo:'ok', vino:[], falto:A });
igual("sin tildes", interpretarPaseLista("falto sofia", A), { tipo:'ok', falto:['Sofía'] });
igual("nombre que no existe", interpretarPaseLista("no fue Benjamín", A), { tipo:'no-entendi' });
igual("ambigua", interpretarPaseLista("vino solo Mateo", A), { tipo:'no-entendi' });
igual("vacía", interpretarPaseLista("   ", A), { tipo:'no-entendi' });
igual("cualquier cosa", interpretarPaseLista("oye y la cuenta del arriendo?", A), { tipo:'no-entendi' });
```

- [ ] **Step 2: correrlo y ver que falla** — `npm run test:pase-lista`
- [ ] **Step 3: implementar** — orden de las reglas, que importa:
  1. `normalizar` el texto y cada nombre (minúsculas, sin tildes, sin signos).
  2. Buscar nombres mencionados: coincide si el texto contiene el **primer nombre** del alumno como palabra suelta.
  3. `NEGACIONES = ['no vino','no fue','no llego','no asistio','falto','faltaron','falta','menos','sin']`, `TODOS_SI = ['si','sip','todos','vinieron todos','todo bien','ninguno falto']`, `TODOS_NO = ['no vino nadie','nadie','ninguno']`.
  4. Si hay `TODOS_NO` → todos `falto`. Si hay `TODOS_SI` y **ningún** nombre mencionado → todos `vino`.
  5. Si hay nombres **y** alguna negación → esos `falto`, el resto `vino`.
  6. Si hay palabras que parecen nombres pero ninguno está en la lista del día → `no-entendi` (no se inventa a nadie).
  7. Cualquier otro caso → `no-entendi`. **Ante la duda nunca se adivina**: marcar mal a un niño es peor que preguntar.
- [ ] **Step 4: correr y ver verde** + `npm run typecheck`
- [ ] **Step 5: commit** — `feat(pase-lista): el parser que entiende "no fue Mateo" sin usar IA`

---

### Task 3: Qué tiene Mary ese día

**Files:**
- Create: `src/lib/dia-de-mary.ts`
- Create: `scripts/test-dia-de-mary.ts`
- Modify: `package.json` (`test:dia-mary`)

**Interfaces — Consumes:** `clasesFijasDeFecha`, `listClasesRange`, `recordatoriosDeFecha`, `pagosFijosDeFecha`, `listClientes` de `db.ts` (verificar los nombres exactos antes de escribir; si `pagosFijosDeFecha` o `listClientes` no existen con ese nombre, usar el que haya y anotarlo).

**Produces:**
```ts
export interface ItemDia { hora: string | null; texto: string; tipo: 'clase' | 'recordatorio' | 'pago' }
export interface DiaDeMary { items: ItemDia[]; alumnos: string[] }   // alumnos: nombres únicos, en el orden en que aparecen
export function armarDia(fecha: string): DiaDeMary
```

- [ ] **Step 1: test que falla** — crea en la base una clase fija de prueba, un evento puntual con un alumno de `clientes`, un recordatorio y un pago fijo, todo en una fecha `2099-01-05`; comprueba que `armarDia` devuelve los 4 items ordenados por hora (los sin hora al final), que `alumnos` no repite un nombre que sale en dos clases, y que un día vacío devuelve `{items: [], alumnos: []}`. Limpieza al final.
- [ ] **Step 2: correr y ver que falla**
- [ ] **Step 3: implementar** — resolver los ids numéricos de `clases.alumnos` a nombre con `clientes` (igual que `etiquetaAlumno` en `calendario/page.tsx:245`); los que son texto van tal cual.
- [ ] **Step 4: verde** + typecheck
- [ ] **Step 5: commit** — `feat(dia): junta clases, recordatorios y pagos de una fecha`

---

### Task 4: Cuándo y qué se manda (puro)

**Files:**
- Create: `src/lib/avisos-mary.ts`
- Create: `scripts/test-avisos-mary.ts`
- Modify: `package.json` (`test:avisos-mary`)

**Interfaces — Produces:**
```ts
export const HORA_RESUMEN_DIA = 10;
export const HORA_PASE_LISTA = 21;
export const GRACIA_MIN = 180;
export function tocaAviso(tipo: 'resumen' | 'pase-lista', ahora: string): boolean   // ahora = "HH:MM"
export function textoResumen(fecha: string, items: ItemDia[]): string
export function textoPaseLista(alumnos: string[]): string
export function textoNoEntendi(): string
export function textoConfirmacion(vino: string[], falto: string[]): string
```

- [ ] **Step 1: test que falla** — `tocaAviso('resumen','09:59')` false, `'10:00'` true, `'12:59'` true, `'13:01'` false; lo mismo con 21:00/23:59/00:10 para el pase de lista. `textoResumen` con 2 clases + 1 recordatorio + 1 pago contiene las horas ordenadas y no tiene líneas vacías. `textoPaseLista(['Mateo'])` dice "Hoy tenías a Mateo" (singular) y con 3 usa "y" antes del último. `textoConfirmacion([],['Mateo'])` nombra a Mateo como el que faltó.
- [ ] **Step 2: correr y ver que falla**
- [ ] **Step 3: implementar** — formato del spec (`☀️ Hoy martes 12`, líneas `HH:MM texto`, `⏰` recordatorios, `💸` pagos; `📋` el pase de lista). El día de la semana en castellano sale de `DIA_LABEL`/`diaFromFecha` de `lib/calendario.ts`.
- [ ] **Step 4: verde** + typecheck
- [ ] **Step 5: commit** — `feat(avisos): las horas y los textos de los dos avisos nuevos`

---

### Task 5: El loop que los manda y apagar los push viejos

**Files:**
- Create: `src/lib/avisos-mary-loop.ts`
- Modify: `src/lib/recordatorios-loop.ts` (apagar push + llamar al tick nuevo)
- Modify: `src/lib/recordatorios.ts` (constante `AVISOS_PUSH_ACTIVOS`)
- Create: `scripts/test-avisos-envio.ts`
- Modify: `package.json` (`test:avisos-envio`)

**Interfaces — Produces:**
```ts
export interface ResultadoAvisos { encolados: number; confirmados: number }
export function tickAvisosMary(opts?: { hoy?: string; ahora?: string; phone?: string | null }): ResultadoAvisos
```

- [ ] **Step 1: test que falla** — calcado de `test-recordatorios-envio.ts`: con `phone: null` no encola nada; con teléfono encola 1 y **no** marca enviado; segunda pasada no repite; `markOutboxSent` + tick → confirmado; `markOutboxFailed` → lo suelta y reintenta; **día sin nada agendado no encola nada**; a las 21:00 con alumnos abre el `pase_lista` con la lista correcta. Limpieza: descarta los envíos de prueba y borra la conversación falsa (como hace ese test en su sección final).
- [ ] **Step 2: correr y ver que falla**
- [ ] **Step 3: implementar**
  - `tickAvisosMary`: (1) confirma lo que estaba en la cola (mismo candado que `tickRecordatoriosWa`); (2) si `tocaAviso('resumen', ahora)` y no hay fila enviada/encolada de hoy y `armarDia(hoy).items.length > 0` → encola el texto y `marcarAvisoEncolado`; (3) igual con el pase de lista, y además `abrirPaseLista(hoy, alumnos)` — solo si `alumnos.length > 0`.
  - En `recordatorios.ts`: `export const AVISOS_PUSH_ACTIVOS = false;` y al principio de `recordatoriosPendientes`, `if (!AVISOS_PUSH_ACTIVOS) return [];`. **No se borra el código ni sus tests**: si Lukas los quiere de vuelta, es cambiar el false.
  - Los tests viejos de `test:recordatorios` que esperan avisos ahora fallarían: se les pasa `AVISOS_PUSH_ACTIVOS` en la aserción o se marcan como "apagados a propósito" con una nota que cite este plan. Decidir al verlos, sin borrar ninguno.
  - En `recordatorios-loop.ts`, dentro del mismo `run()`, llamar `tickAvisosMary()` en su **propio try/catch** (un fallo aquí no se lleva por delante lo demás).
- [ ] **Step 4: verde** — `npm run test:avisos-envio`, `npm run test:recordatorios`, `npm run test:recordatorios-wa`, `npm run test:recordatorios-envio`, typecheck
- [ ] **Step 5: commit** — `feat(avisos): los dos avisos salen por WhatsApp y se apagan los push viejos`

---

### Task 6: Que el bot escuche la respuesta de Mary

**Files:**
- Modify: `src/lib/avisos-mary-loop.ts` (función nueva)
- Modify: `src/lib/baileys/handler.ts` (rama del propio número, dentro del bloque `if (msg.key.fromMe)` de la línea 185)
- Create: `scripts/test-respuesta-pase-lista.ts`
- Modify: `package.json` (`test:respuesta-pase`)

**Interfaces — Produces:**
```ts
/** ¿Este texto era la respuesta al pase de lista? true = ya se atendió, el handler no sigue. */
export function procesarRespuestaPaseLista(texto: string, opts?: { hoy?: string; ahora?: string; phone?: string | null }): boolean
```

- [ ] **Step 1: test que falla** — sin pase de lista abierto devuelve `false` (el mensaje sigue su camino de siempre); con uno abierto y "no fue Mateo" devuelve `true`, deja `asistencia` con Mateo `falto` y el resto `vino`, cierra el pase y encola la confirmación; con "cualquier cosa" devuelve `true`, no marca nada, suma una aclaración y encola el texto de "no te entendí"; a la **segunda** vez que no entiende, no vuelve a preguntar (aclaraciones = 1 ya gastada) y deja el día sin marcar; un pase de lista de **anteayer** ya no acepta respuesta (vence al día siguiente a las 12:00).
- [ ] **Step 2: correr y ver que falla**
- [ ] **Step 3: implementar** — en el handler, dentro de la rama `fromMe`, **antes** de `insertMessage`: si `phoneSal === telefonoDelBot()` y `procesarRespuestaPaseLista(textoSal)` devuelve true → `continue`. Así el chat consigo misma no se llena de ruido ni apaga el bot en esa conversación. Si devuelve false, todo sigue exactamente como hoy.
- [ ] **Step 4: verde** — el test nuevo + `npm run test:quien-contesta` + `npm run test:mudos` (que la rama nueva no cambie a quién contesta el bot) + typecheck
- [ ] **Step 5: commit** — `feat(pase-lista): el bot entiende lo que Mary contesta en su propio chat`

---

### Task 7: Los puntitos en el calendario

**Files:**
- Create: `src/app/api/asistencia/route.ts`
- Modify: `src/app/calendario/page.tsx`
- Create: `scripts/test-asistencia-api.mjs`
- Modify: `package.json` (`test:asistencia-api`)

**Interfaces — Consumes:** `asistenciaRango`, `marcarAsistencia`, `borrarAsistencia` (Task 1). La ruta usa la misma autenticación que `src/app/api/clases/route.ts`.

- [ ] **Step 1: test que falla** — script tipo `test-calendario-extras.mjs`: `GET /api/asistencia?desde=&hasta=` devuelve 200 y la lista; `POST` con `{fecha, alumno, estado:'falto'}` la guarda con `fuente:'panel'`; `POST` con estado inválido devuelve 400; sin sesión devuelve 401.
- [ ] **Step 2: correr y ver que falla** (con el servidor en `npm run dev`)
- [ ] **Step 3: implementar**
  - La ruta GET/POST.
  - En `page.tsx`: cargar la asistencia del mes junto al resto (`Promise.all` de la línea 96); junto a cada alumno (líneas ~428 y ~492) un `<button>` con el puntito de 10 px — verde `#00A884`, rojo `#EF4444`, gris `#D1D5DB` — que cicla sin marca → vino → faltó y hace POST. Tocable de verdad en el móvil (mínimo 24 px de área, como se arregló en los botones del iPhone).
  - Debajo del día, sección **"Faltaron este mes"**: nombre, cuántas veces y los días, ordenado de más a menos faltas. Si no falta nadie, no se muestra.
- [ ] **Step 4: verde** — el test nuevo + `npm run test:calendario` + `npm run test:calendario-extras` + `npm run typecheck` + `npm run build`
- [ ] **Step 5: commit** — `feat(calendario): puntitos de asistencia y la lista de los que faltaron`

---

### Task 8: Probarlo de verdad antes de decir que está listo

- [ ] **Step 1** — correr TODA la batería del repo (los `test:*` de `package.json`), pegar la salida. Ninguna en rojo.
- [ ] **Step 2** — prueba de humo con la base real: crear una clase de prueba HOY con 2 alumnos falsos, forzar `tickAvisosMary({ahora:'21:00'})`, ver el mensaje en la cola, simular la respuesta "no fue X" y comprobar la fila de asistencia. Borrar todo lo de prueba al final.
- [ ] **Step 3** — `npm run build` y abrir el calendario en local con Playwright: ver los puntitos y la sección de ausencias.
- [ ] **Step 4** — commit de la bitácora: anotar en `errores-sesion.md` lo que se aprendió (y el acierto de haber listado la familia de avisos antes de apagar nada).
- [ ] **Step 5** — contarle a Lukas qué quedó y pedirle el OK **antes** de `git push` (el deploy de esta app se dispara a mano por webhook, ver `reference_arteluk_panel_acceso`).
