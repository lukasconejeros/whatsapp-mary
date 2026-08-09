# La tarde de entrenamiento de Mary — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Mary entrene al bot ella sola en una tarde — corrigiendo cada respuesta y grabando audios con su voz — sin que pueda perder nada de lo que hizo.

**Architecture:** Todo vive dentro de la pestaña **Bot** (`/ensayo`) y de la base SQLite en `data/` (volumen persistente verificado en producción el 09-08-2026). El chat de ensayo deja de borrar: se archiva por `sesion_id`. Cada respuesta del bot puede llevar una corrección de Mary (texto y/o audio). Sus audios viven en una tabla nueva `audios_mary` + archivos en `data/media`. El modelo puede **proponer** un audio con una tool que existe SOLO en el ensayo (el bot de WhatsApp real no se toca).

**Tech Stack:** Next.js 16 (App Router), better-sqlite3, TypeScript, tsx para tests, Anthropic API directa (`claude-haiku-4-5-20251001`), MediaRecorder del navegador, ffmpeg vía `src/lib/audio.ts`.

## Global Constraints

- **Nada se borra, nunca.** Ninguna función nueva puede hacer `DELETE FROM ensayo_mensajes`. "Empezar de nuevo" archiva.
- **El cerebro no cambia solo**: las correcciones se guardan y se leen; `prompts/negocio.md` no se toca desde código.
- **El bot no manda audios solo**: en el ensayo se muestra la propuesta; nunca se envía nada.
- **NO tocar `src/lib/baileys/`** (regla 5 del CLAUDE.md del kit) ni el handler de WhatsApp real.
- **NO tocar el registro global de tools** (`src/lib/tools/index.ts`): la tool `proponerAudio` se inyecta solo en el motor del ensayo.
- Migraciones **idempotentes** con `addColumnaSiFalta` (bot y web arrancan a la vez tras un deploy).
- Los archivos de audio se validan con `esNombreMediaSeguro` (`src/lib/media-path.ts`) antes de tocar disco.
- Textos de la interfaz **en chileno simple**, sin jerga: los lee Mary, no un técnico.
- Paleta verde WhatsApp ya vigente: acento `#00A884`, oscuro `#008069`, títulos `#054D44`, bordes `#D3E7DE`, fondos `#F3F9F6`, tenue `#667781`.
- Tests: un script por área en `scripts/`, registrado en `package.json`. Verde ≠ listo: al final se prueba por HTTP con el panel andando.

---

### Task 1: La tarde no se puede borrar

**Files:**
- Modify: `src/lib/db.ts` (SCHEMA ~línea 221, migraciones ~línea 339, funciones de ensayo ~líneas 1305-1352)
- Modify: `src/app/api/ensayo/route.ts:57-61` (DELETE)
- Modify: `src/app/ensayo/page.tsx:87-92` (`empezarDeNuevo`)
- Modify: `scripts/test-ensayo.ts:38` (el test que hoy exige que borre)
- Create: `scripts/test-entrenamiento.ts`
- Modify: `package.json` (script `test:entrenamiento`)

**Interfaces:**
- Consumes: `getConfig/setConfig` (`db.ts:500-506`), `addColumnaSiFalta` (`db.ts:305`).
- Produces:
  - `sesionEnsayoActual(): number`
  - `archivarEnsayo(): { archivados: number; sesion: number }`
  - `listEnsayoMensajes(limit?: number): EnsayoMensaje[]` — ahora solo la sesión actual
  - `listEnsayoTodo(): EnsayoMensaje[]` — todas las sesiones, orden de conversación
  - `EnsayoMensaje` gana `sesion_id: number`
  - `limpiarEnsayo()` **desaparece** (nadie más puede borrar)

- [ ] **Step 1: Escribir el test que falla** — `scripts/test-entrenamiento.ts`

```ts
import "./env-loader.js";
import {
  addEnsayoMensaje, listEnsayoMensajes, listEnsayoTodo,
  archivarEnsayo, sesionEnsayoActual,
} from "../src/lib/db.js";

let pass = 0, fail = 0;
function check(n: string, c: boolean) { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n}`); fail++; } }

console.log("\n🧪 TEST la tarde de entrenamiento\n");

console.log("— Empezar de nuevo NO borra la tarde de Mary —");
const antes = listEnsayoTodo().length;
const sesion0 = sesionEnsayoActual();
addEnsayoMensaje("apoderado", "Hola, cuánto cuesta");
addEnsayoMensaje("bot", "¿Para quién sería la clase?");
check("la práctica se ve en pantalla", listEnsayoMensajes().length >= 2);

const r = archivarEnsayo();
check("archiva los que había", r.archivados >= 2);
check("sube el número de sesión", r.sesion === sesion0 + 1 && sesionEnsayoActual() === sesion0 + 1);
check("la pantalla queda limpia", listEnsayoMensajes().length === 0);
check("PERO no se borró ni una fila", listEnsayoTodo().length === antes + 2);
check("las filas viejas guardan su sesión", listEnsayoTodo().slice(-2).every(m => m.sesion_id === sesion0));

addEnsayoMensaje("apoderado", "Ya, y para adultos?");
check("lo nuevo entra en la sesión nueva", listEnsayoMensajes().length === 1 && listEnsayoMensajes()[0].sesion_id === sesion0 + 1);
check("y lo viejo sigue estando", listEnsayoTodo().length === antes + 3);

console.log(`\n${fail === 0 ? "🎉" : "⚠️"}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `npx tsx scripts/test-entrenamiento.ts`
Expected: FAIL — `listEnsayoTodo` / `archivarEnsayo` / `sesionEnsayoActual` no existen.

- [ ] **Step 3: Migración + funciones nuevas en `src/lib/db.ts`**

En el bloque de micro-migraciones (junto a `addColumnaSiFalta(db, "clases", "fecha", "TEXT")`):

```ts
  // Entrenamiento de Mary (09-08-2026): la práctica se ARCHIVA por sesión, nunca se borra.
  addColumnaSiFalta(db, "ensayo_mensajes", "sesion_id", "INTEGER NOT NULL DEFAULT 1");
  db.exec("CREATE INDEX IF NOT EXISTS idx_ensayo_sesion ON ensayo_mensajes(sesion_id, id)");
```

En el `interface EnsayoMensaje`, agregar `sesion_id: number;`.

Reemplazar `limpiarEnsayo` y ajustar el resto:

```ts
const CLAVE_SESION_ENSAYO = "ensayo_sesion";

/** Número de la práctica en curso. Las anteriores quedan archivadas, no borradas. */
export function sesionEnsayoActual(): number {
  const n = parseInt(getConfig(CLAVE_SESION_ENSAYO, "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function addEnsayoMensaje(
  rol: "apoderado" | "bot",
  texto: string,
  acciones?: string[]
): number {
  const r = ctx().db
    .prepare("INSERT INTO ensayo_mensajes (rol, texto, acciones, sesion_id) VALUES (?,?,?,?)")
    .run(rol, texto, acciones?.length ? JSON.stringify(acciones) : null, sesionEnsayoActual());
  return r.lastInsertRowid as number;
}

/** Lo que se ve en pantalla: SOLO la práctica en curso. */
export function listEnsayoMensajes(limit = 200): EnsayoMensaje[] {
  const rows = ctx().db
    .prepare("SELECT * FROM ensayo_mensajes WHERE sesion_id = ? ORDER BY id DESC LIMIT ?")
    .all(sesionEnsayoActual(), limit) as EnsayoMensaje[];
  return rows.reverse();
}

/** TODO lo que Mary ha entrenado, todas las sesiones. Es lo que leemos nosotros después. */
export function listEnsayoTodo(): EnsayoMensaje[] {
  return ctx().db
    .prepare("SELECT * FROM ensayo_mensajes ORDER BY id ASC")
    .all() as EnsayoMensaje[];
}

/**
 * "Empezar de nuevo": deja la pantalla limpia SIN borrar nada. Sube el número de
 * sesión; lo anterior queda archivado y se puede leer con listEnsayoTodo().
 */
export function archivarEnsayo(): { archivados: number; sesion: number } {
  const actual = sesionEnsayoActual();
  const n = ctx().db
    .prepare("SELECT COUNT(*) AS n FROM ensayo_mensajes WHERE sesion_id = ?")
    .get(actual) as { n: number };
  const nueva = actual + 1;
  setConfig(CLAVE_SESION_ENSAYO, String(nueva));
  return { archivados: n.n, sesion: nueva };
}
```

`marcarEnsayoMalo` y `listEnsayoMalos` se dejan como están **a propósito**: las marcas sirven para afinar el cerebro y valen las de todas las sesiones.

- [ ] **Step 4: Correr el test nuevo y el viejo**

Run: `npx tsx scripts/test-entrenamiento.ts`
Expected: PASS (8/8).

Run: `npm run test:ensayo`
Expected: FALLA en "empezar de nuevo borra la práctica" — es el test viejo, que exigía justo lo que ahora está prohibido.

- [ ] **Step 5: Arreglar el test viejo** — `scripts/test-ensayo.ts`

Reemplazar el import de `limpiarEnsayo` por `archivarEnsayo` y las tres líneas que lo usan:

```ts
// línea 13
archivarEnsayo();
// líneas 38-39
check("empezar de nuevo NO borra nada, archiva", archivarEnsayo().archivados > 0 && listEnsayoMensajes().length === 0);
check("y la conversación real sigue intacta", getMessages(conv.id).length === antes);
```

Run: `npm run test:ensayo` → PASS.

- [ ] **Step 6: El DELETE de la API archiva** — `src/app/api/ensayo/route.ts`

```ts
/** Empezar de nuevo: deja la pantalla limpia SIN borrar la práctica (queda archivada). */
export async function DELETE() {
  const { archivados, sesion } = archivarEnsayo();
  return NextResponse.json({ ok: true, archivados, sesion });
}
```

Cambiar también el import (`limpiarEnsayo` → `archivarEnsayo`).

- [ ] **Step 7: Que la pantalla no le mienta** — `src/app/ensayo/page.tsx:87-92`

```tsx
  async function empezarDeNuevo() {
    if (!confirm('Empezamos una práctica nueva. Lo que hiciste hasta ahora queda guardado, no se pierde.')) return
    await fetch('/api/ensayo', { method: 'DELETE' })
    setMsgs([])
    setError('')
  }
```

Y el `title` del botón: `"Empieza una práctica nueva. Lo anterior queda guardado"`.

- [ ] **Step 8: Registrar el test y verificar todo**

En `package.json`: `"test:entrenamiento": "tsx scripts/test-entrenamiento.ts",`

Run: `npm run test:entrenamiento && npm run test:ensayo && npm run test:db && npm run typecheck && npm run build`
Expected: verdes; typecheck solo con los 4 errores preexistentes (`ai.ts` ×3, `client.ts` version readonly).

- [ ] **Step 9: Commit**

```bash
git add src/lib/db.ts src/app/api/ensayo/route.ts src/app/ensayo/page.tsx scripts/test-entrenamiento.ts scripts/test-ensayo.ts package.json
git commit -m "fix(ensayo): empezar de nuevo ya no borra la tarde de Mary, la archiva"
```

---

### Task 2: "Yo diría esto" — la corrección escrita o hablada

**Files:**
- Modify: `src/lib/db.ts` (migraciones + funciones de ensayo)
- Modify: `src/app/api/ensayo/route.ts` (PATCH)
- Create: `src/app/api/ensayo/correccion-audio/route.ts`
- Modify: `src/app/ensayo/page.tsx` (bloque de corrección bajo cada respuesta del bot)
- Modify: `scripts/test-entrenamiento.ts`

**Interfaces:**
- Consumes: `EnsayoMensaje`, `esNombreMediaSeguro` (`src/lib/media-path.ts:8`), `prepararNotaVoz` (`src/lib/audio.ts`).
- Produces:
  - `guardarCorreccion(id: number, texto: string | null): boolean`
  - `guardarCorreccionAudio(id: number, archivo: string, segundos: number): boolean`
  - `EnsayoMensaje` gana `correccion: string | null`, `correccion_audio: string | null`, `correccion_seg: number | null`

- [ ] **Step 1: Test que falla** — agregar al final de `scripts/test-entrenamiento.ts` (antes del resumen)

```ts
console.log("\n— 'Yo diría esto': la corrección queda pegada a la respuesta —");
const idBot = addEnsayoMensaje("bot", "Hola! Los valores son 45.000 y 60.000 mensuales.");
check("guarda lo que ella diría", guardarCorreccion(idBot, "Yo primero pregunto la edad, no tiro los precios"));
const conCorr = listEnsayoTodo().find(m => m.id === idBot);
check("queda pegada a ESA respuesta", conCorr?.correccion?.includes("pregunto la edad") === true);
check("guarda la corrección hablada", guardarCorreccionAudio(idBot, "correccion_test.ogg", 7));
const conAudio = listEnsayoTodo().find(m => m.id === idBot);
check("con su archivo y su duración", conAudio?.correccion_audio === "correccion_test.ogg" && conAudio?.correccion_seg === 7);
check("el texto no se pierde al grabar", conAudio?.correccion?.includes("pregunto la edad") === true);
check("no se corrige lo que escribió el apoderado", !guardarCorreccion(addEnsayoMensaje("apoderado", "hola"), "nada"));
check("borrar la corrección la deja vacía, no rompe", guardarCorreccion(idBot, null) && listEnsayoTodo().find(m => m.id === idBot)?.correccion === null);
```

Run: `npx tsx scripts/test-entrenamiento.ts` → FAIL (`guardarCorreccion` no existe).

- [ ] **Step 2: Migración y funciones** — `src/lib/db.ts`

Junto a la migración de `sesion_id`:

```ts
  addColumnaSiFalta(db, "ensayo_mensajes", "correccion", "TEXT");
  addColumnaSiFalta(db, "ensayo_mensajes", "correccion_audio", "TEXT");
  addColumnaSiFalta(db, "ensayo_mensajes", "correccion_seg", "INTEGER");
```

Campos nuevos en `interface EnsayoMensaje` y, después de `marcarEnsayoMalo`:

```ts
/** "Yo diría esto", escrito. `null` borra la corrección. Solo aplica a respuestas del bot. */
export function guardarCorreccion(id: number, texto: string | null): boolean {
  const limpio = texto === null ? null : texto.trim();
  const r = ctx().db
    .prepare("UPDATE ensayo_mensajes SET correccion = ? WHERE id = ? AND rol = 'bot'")
    .run(limpio && limpio.length ? limpio : null, id);
  return r.changes > 0;
}

/** "Yo diría esto", hablado. Convive con el texto: grabar no pisa lo escrito. */
export function guardarCorreccionAudio(id: number, archivo: string, segundos: number): boolean {
  const r = ctx().db
    .prepare("UPDATE ensayo_mensajes SET correccion_audio = ?, correccion_seg = ? WHERE id = ? AND rol = 'bot'")
    .run(archivo, Math.max(0, Math.round(segundos)), id);
  return r.changes > 0;
}
```

Run: `npx tsx scripts/test-entrenamiento.ts` → PASS.

- [ ] **Step 3: PATCH acepta la corrección escrita** — `src/app/api/ensayo/route.ts`

```ts
export async function PATCH(req: NextRequest) {
  let body: { id?: number; malo?: boolean; correccion?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }
  // "Yo diría esto" y el pulgar abajo son independientes: puede usar uno, otro o los dos.
  if ("correccion" in body) {
    const ok = guardarCorreccion(id, typeof body.correccion === "string" ? body.correccion : null);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }
  const ok = marcarEnsayoMalo(id, body.malo !== false);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
```

- [ ] **Step 4: Endpoint del audio de corrección** — `src/app/api/ensayo/correccion-audio/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { guardarCorreccionAudio } from "@/lib/db";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Mary graba con el micrófono del teléfono lo que ELLA diría. El archivo se guarda
// tal cual en data/media (volumen persistente): esto no se manda a nadie, se escucha
// después para armar el cerebro definitivo.
const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const MAX_BYTES = 16 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const rl = limitar(req, "correccion-audio", 60); if (rl) return rl;
  const form = await req.formData();
  const file = form.get("file");
  const id = Number(form.get("id"));
  const segundos = Math.max(0, Math.round(Number(form.get("segundos")) || 0));
  if (!Number.isFinite(id) || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Faltan datos (id, file)" }, { status: 400 });
  }
  const mime = (file.type || "").toLowerCase();
  if (!mime.startsWith("audio/")) {
    return NextResponse.json({ ok: false, error: "solo audio" }, { status: 415 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return NextResponse.json({ ok: false, error: "archivo vacío" }, { status: 400 });
  if (buffer.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "archivo muy grande" }, { status: 413 });

  const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("mpeg") ? "mp3" : "ogg";
  const name = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  } catch (e) {
    console.error("correccion-audio:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el audio" }, { status: 500 });
  }
  const ok = guardarCorreccionAudio(id, name, segundos);
  return NextResponse.json({ ok, media: name, segundos }, { status: ok ? 200 : 404 });
}
```

- [ ] **Step 5: El cuadro de corrección en la pantalla** — `src/app/ensayo/page.tsx`

Al tipo `Msg` agregarle `correccion?: string`, `correccionAudio?: string`. Mapearlos en `cargar()` (`correccion: m.correccion ?? undefined`, `correccionAudio: m.correccion_audio ?? undefined`).

Estado y funciones nuevas dentro del componente:

```tsx
  const [editando, setEditando] = useState<number | null>(null)
  const [borrador, setBorrador] = useState('')
  const [grabandoId, setGrabandoId] = useState<number | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const inicioRef = useRef(0)

  // Nombre distinto al de db.ts a propósito: esta es la de la pantalla.
  async function guardarCorreccionTexto(id: number) {
    const t = borrador.trim()
    await fetch('/api/ensayo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, correccion: t }),
    })
    setMsgs(m => m.map(x => x.id === id ? { ...x, correccion: t || undefined } : x))
    setEditando(null); setBorrador('')
  }

  async function grabarCorreccion(id: number) {
    if (grabandoId !== null) { recRef.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []; inicioRef.current = Date.now()
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const segundos = Math.round((Date.now() - inicioRef.current) / 1000)
        const fd = new FormData()
        fd.append('file', new Blob(chunksRef.current, { type: mime }), 'correccion')
        fd.append('id', String(id)); fd.append('segundos', String(segundos))
        const r = await fetch('/api/ensayo/correccion-audio', { method: 'POST', body: fd })
        const d = await r.json()
        if (d.ok) setMsgs(m => m.map(x => x.id === id ? { ...x, correccionAudio: d.media } : x))
        else setError('No se pudo guardar el audio')
        setGrabandoId(null)
      }
      recRef.current = rec; rec.start(); setGrabandoId(id)
    } catch {
      setError('No pude usar el micrófono. Dale permiso al navegador.')
      setGrabandoId(null)
    }
  }
```

Debajo del botón "Esto yo no lo diría" (dentro del `m.rol === 'bot' && m.id > 0`):

```tsx
                  {editando === m.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      <textarea value={borrador} onChange={e => setBorrador(e.target.value)} rows={3}
                        placeholder="Escribe con tus palabras lo que le dirías tú…"
                        style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #D3E7DE', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => guardarCorreccion(m.id)}
                          style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: '#00A884', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
                        <button onClick={() => grabarCorreccion(m.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, border: '1px solid #D3E7DE', background: grabandoId === m.id ? '#FDECEC' : '#F3F9F6', color: grabandoId === m.id ? '#B03A3A' : '#008069', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          <Mic size={13} /> {grabandoId === m.id ? 'Listo, guardar' : 'Decirlo hablando'}
                        </button>
                        <button onClick={() => { setEditando(null); setBorrador('') }}
                          style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#fff', color: '#667781', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setEditando(m.id); setBorrador(m.correccion ?? '') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#008069', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Pencil size={11} /> {m.correccion || m.correccionAudio ? 'Cambiar lo que dirías tú' : 'Yo diría esto'}
                    </button>
                  )}

                  {m.correccion && editando !== m.id && (
                    <div style={{ fontSize: 12, color: '#054D44', background: '#E7F1EC', border: '1px solid #C7E0D5', borderRadius: 9, padding: '6px 10px', whiteSpace: 'pre-wrap' }}>
                      Tú dirías: {m.correccion}
                    </div>
                  )}
                  {m.correccionAudio && (
                    <audio controls src={`/api/media/${m.correccionAudio}`} style={{ height: 32, maxWidth: 240 }} />
                  )}
```

Import de iconos: `import { Send, RotateCcw, ThumbsDown, Clock, Zap, Mic, Pencil } from 'lucide-react'`.

- [ ] **Step 6: Verificar**

Run: `npm run test:entrenamiento && npm run test:ensayo && npm run typecheck && npm run build` → verdes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/app/api/ensayo src/app/ensayo/page.tsx scripts/test-entrenamiento.ts
git commit -m "feat(ensayo): Mary puede escribir o grabar lo que ella diria en cada respuesta"
```

---

### Task 3: Sus audios guardados ("Mis audios")

**Files:**
- Modify: `src/lib/db.ts` (tabla `audios_mary` en SCHEMA + funciones)
- Create: `src/app/api/audios-mary/route.ts`
- Create: `src/app/ensayo/audios/page.tsx`
- Modify: `src/app/ensayo/page.tsx` (enlace "Mis audios" en la cabecera)
- Modify: `scripts/test-entrenamiento.ts`

**Interfaces:**
- Produces:
  - `interface AudioMary { id: number; archivo: string; titulo: string; cuando_usarlo: string; segundos: number; created_at: number }`
  - `addAudioMary(a: { archivo: string; titulo: string; cuando_usarlo: string; segundos: number }): number`
  - `listAudiosMary(): AudioMary[]`
  - `updateAudioMary(id: number, campos: { titulo?: string; cuando_usarlo?: string }): boolean`
  - `deleteAudioMary(id: number): boolean` — borra la FILA; el archivo queda en disco a propósito (nunca se borra media de Mary)

- [ ] **Step 1: Test que falla** — agregar a `scripts/test-entrenamiento.ts`

```ts
console.log("\n— Mis audios: los graba ella y dice cuándo usarlos —");
const idA = addAudioMary({ archivo: "audio_test.ogg", titulo: "el del autismo", cuando_usarlo: "cuando preguntan por niños con autismo", segundos: 24 });
check("guarda el audio", idA > 0);
const a = listAudiosMary().find(x => x.id === idA);
check("con el nombre que ella le puso", a?.titulo === "el del autismo");
check("y con SUS palabras de cuándo usarlo", a?.cuando_usarlo.includes("autismo") === true);
check("guarda la duración", a?.segundos === 24);
check("puede renombrarlo", updateAudioMary(idA, { titulo: "el de los niños especiales" }) && listAudiosMary().find(x => x.id === idA)?.titulo === "el de los niños especiales");
check("cambiar el título no borra el cuándo usarlo", listAudiosMary().find(x => x.id === idA)?.cuando_usarlo.includes("autismo") === true);
check("puede sacarlo de la lista", deleteAudioMary(idA) && !listAudiosMary().some(x => x.id === idA));
```

Run: `npx tsx scripts/test-entrenamiento.ts` → FAIL.

- [ ] **Step 2: Tabla y funciones** — `src/lib/db.ts`

En el SCHEMA, después de `ensayo_mensajes`:

```sql
-- Los audios que Mary graba con SU voz para las preguntas que no se contestan bien
-- por escrito. 'cuando_usarlo' está en sus palabras: es el material con el que
-- después configuramos al bot. El bot solo los PROPONE; ella aprieta enviar.
CREATE TABLE IF NOT EXISTS audios_mary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archivo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cuando_usarlo TEXT NOT NULL DEFAULT '',
  segundos INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Funciones, después de las del ensayo:

```ts
export interface AudioMary {
  id: number; archivo: string; titulo: string;
  cuando_usarlo: string; segundos: number; created_at: number;
}

export function addAudioMary(a: { archivo: string; titulo: string; cuando_usarlo: string; segundos: number }): number {
  const r = ctx().db
    .prepare("INSERT INTO audios_mary (archivo, titulo, cuando_usarlo, segundos) VALUES (?,?,?,?)")
    .run(a.archivo, a.titulo.trim(), a.cuando_usarlo.trim(), Math.max(0, Math.round(a.segundos)));
  return r.lastInsertRowid as number;
}

export function listAudiosMary(): AudioMary[] {
  return ctx().db.prepare("SELECT * FROM audios_mary ORDER BY id ASC").all() as AudioMary[];
}

export function updateAudioMary(id: number, campos: { titulo?: string; cuando_usarlo?: string }): boolean {
  const sets: string[] = []; const vals: unknown[] = [];
  if (typeof campos.titulo === "string") { sets.push("titulo = ?"); vals.push(campos.titulo.trim()); }
  if (typeof campos.cuando_usarlo === "string") { sets.push("cuando_usarlo = ?"); vals.push(campos.cuando_usarlo.trim()); }
  if (!sets.length) return false;
  vals.push(id);
  return ctx().db.prepare(`UPDATE audios_mary SET ${sets.join(", ")} WHERE id = ?`).run(...vals).changes > 0;
}

/** Lo saca de la lista. El ARCHIVO no se borra: nada de lo que grabó se pierde. */
export function deleteAudioMary(id: number): boolean {
  return ctx().db.prepare("DELETE FROM audios_mary WHERE id = ?").run(id).changes > 0;
}
```

Run: `npx tsx scripts/test-entrenamiento.ts` → PASS.

- [ ] **Step 3: API** — `src/app/api/audios-mary/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { addAudioMary, listAudiosMary, updateAudioMary, deleteAudioMary } from "@/lib/db";
import { limitar } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const MEDIA_DIR = path.resolve(process.cwd(), "data/media");
const MAX_BYTES = 16 * 1024 * 1024;

export async function GET() {
  return NextResponse.json({ ok: true, audios: listAudiosMary() });
}

// Multipart: file + titulo + cuando_usarlo + segundos. El audio se guarda tal cual;
// la conversión a nota de voz se hace recién al mandarlo por WhatsApp.
export async function POST(req: NextRequest) {
  const rl = limitar(req, "audios-mary", 60); if (rl) return rl;
  const form = await req.formData();
  const file = form.get("file");
  const titulo = String(form.get("titulo") ?? "").trim();
  const cuando = String(form.get("cuando_usarlo") ?? "").trim();
  const segundos = Math.max(0, Math.round(Number(form.get("segundos")) || 0));
  if (!(file instanceof Blob) || !titulo) {
    return NextResponse.json({ ok: false, error: "Falta el audio o el nombre" }, { status: 400 });
  }
  const mime = (file.type || "").toLowerCase();
  if (!mime.startsWith("audio/")) return NextResponse.json({ ok: false, error: "solo audio" }, { status: 415 });
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return NextResponse.json({ ok: false, error: "archivo vacío" }, { status: 400 });
  if (buffer.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "archivo muy grande" }, { status: 413 });

  const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("mpeg") ? "mp3" : "ogg";
  const name = `mary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  } catch (e) {
    console.error("audios-mary:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el audio" }, { status: 500 });
  }
  const id = addAudioMary({ archivo: name, titulo, cuando_usarlo: cuando, segundos });
  return NextResponse.json({ ok: true, id, archivo: name });
}

export async function PATCH(req: NextRequest) {
  let b: { id?: number; titulo?: string; cuando_usarlo?: string };
  try { b = (await req.json()) as typeof b } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(b.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const ok = updateAudioMary(id, { titulo: b.titulo, cuando_usarlo: b.cuando_usarlo });
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const ok = deleteAudioMary(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
```

- [ ] **Step 4: Pantalla "Mis audios"** — `src/app/ensayo/audios/page.tsx`

Cliente (`'use client'`) con `AppNav`, que: lista los audios (GET), permite grabar uno nuevo con `MediaRecorder` (mismo patrón del Step 5 de la Task 2: `getUserMedia` → `MediaRecorder` → `onstop` arma el `FormData` con `file`, `titulo`, `cuando_usarlo`, `segundos`), escucharlos con `<audio controls src={'/api/media/' + a.archivo} />`, editar título y "cuándo usarlo" (PATCH al salir del input, `onBlur`) y sacarlos de la lista (DELETE con `confirm('¿Sacamos este audio de la lista? El archivo no se borra.')`).

Textos exactos de la pantalla:
- Título: **"Mis audios"**
- Bajada: **"Graba con tu voz las respuestas que te cuesta escribir. El bot te va a proponer mandarlas; tú decides."**
- Campo 1: **"¿Cómo le llamas?"** — placeholder `el del autismo`
- Campo 2: **"¿Cuándo hay que mandarlo?"** — placeholder `cuando preguntan por niños con autismo`
- Botón: **"Grabar"** / **"Listo, guardar"** (rojo `#FDECEC`/`#B03A3A` mientras graba, con cronómetro en segundos)

- [ ] **Step 5: Enlace desde el ensayo** — `src/app/ensayo/page.tsx`

En la cabecera, junto a "Empezar de nuevo":

```tsx
            <a href="/ensayo/audios"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#008069', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <Mic size={14} /> Mis audios
            </a>
```

- [ ] **Step 6: Verificar y commitear**

Run: `npm run test:entrenamiento && npm run typecheck && npm run build` → verdes; `/ensayo/audios` y `/api/audios-mary` aparecen en la salida del build.

```bash
git add src/lib/db.ts src/app/api/audios-mary src/app/ensayo scripts/test-entrenamiento.ts
git commit -m "feat(ensayo): Mary graba sus audios y dice cuando usarlos"
```

---

### Task 4: El bot PROPONE el audio (nunca lo manda)

**Files:**
- Modify: `src/lib/ensayo.ts` (`simularHerramienta`, `herramientasParaAnthropic`, `responderEnsayo`)
- Modify: `src/app/api/ensayo/route.ts` (pasarle los audios al motor)
- Modify: `scripts/test-entrenamiento.ts`

**Interfaces:**
- Consumes: `listAudiosMary()` (Task 3), `AudioMary`.
- Produces:
  - `simularHerramienta(nombre: string, args: Record<string, unknown>, audios?: AudioMary[]): { aviso: string; resultado: Record<string, unknown> }`
  - `responderEnsayo(turnos: TurnoEnsayo[], audios?: AudioMary[]): Promise<RespuestaEnsayo>`
  - `definicionProponerAudio(audios: AudioMary[]): { name: string; description: string; input_schema: object } | null`

- [ ] **Step 1: Test que falla**

```ts
console.log("\n— El bot PROPONE el audio, no lo manda —");
const audios = [{ id: 7, archivo: "mary_7.ogg", titulo: "el del autismo", cuando_usarlo: "cuando preguntan por niños con autismo", segundos: 20, created_at: 0 }];
const prop = simularHerramienta("proponerAudio", { id: 7 }, audios);
check("avisa que te lo habría propuesto", prop.aviso.includes("propuesto") && prop.aviso.includes("el del autismo"));
check("NO dice que lo mandó", !prop.aviso.toLowerCase().includes("envió") && !prop.aviso.toLowerCase().includes("mandó"));
check("el modelo recibe que salió bien", prop.resultado.ok === true);
check("un id que no existe no revienta", simularHerramienta("proponerAudio", { id: 999 }, audios).resultado.ok === false);
check("sin audios grabados la herramienta no se ofrece", definicionProponerAudio([]) === null);
const def = definicionProponerAudio(audios);
check("la descripción lleva las palabras de Mary", def!.description.includes("cuando preguntan por niños con autismo"));
check("y el título para que elija", def!.description.includes("el del autismo"));
```

Run: `npx tsx scripts/test-entrenamiento.ts` → FAIL.

- [ ] **Step 2: Implementar en `src/lib/ensayo.ts`**

```ts
import type { AudioMary } from "./db";

/**
 * La tool existe SOLO en el ensayo: el bot de WhatsApp real no la tiene (por eso no
 * se toca `src/lib/tools/index.ts`). El modelo únicamente puede elegir un id de la
 * lista que grabó Mary: no inventa audios ni situaciones.
 */
export function definicionProponerAudio(audios: AudioMary[]) {
  if (!audios.length) return null;
  const lista = audios
    .map((a) => `- id ${a.id}: "${a.titulo}" — ${a.cuando_usarlo || "sin indicación"}`)
    .join("\n");
  return {
    name: "proponerAudio",
    description:
      "Propone mandarle a la persona una nota de voz grabada por Mary. NO la envía: " +
      "Mary la revisa y decide. Úsala solo si la situación calza con una de estas:\n" + lista,
    input_schema: {
      type: "object",
      properties: { id: { type: "number", description: "El id del audio de la lista" } },
      required: ["id"],
    },
  };
}
```

En `simularHerramienta`, tercer parámetro `audios: AudioMary[] = []` y el caso nuevo antes del `default`:

```ts
    case "proponerAudio": {
      const id = Number(args.id);
      const audio = audios.find((a) => a.id === id);
      if (!audio) {
        return {
          aviso: "Quiso proponerte un audio que no existe.",
          resultado: { ok: false, message: "No existe un audio con ese id" },
        };
      }
      return {
        aviso: `Aquí te habría propuesto mandarle este audio tuyo: "${audio.titulo}". Tú decides si se manda.`,
        resultado: { ok: true, propuesto: audio.titulo },
      };
    }
```

En `herramientasParaAnthropic(audios: AudioMary[] = [])`, agregar la definición si existe:

```ts
function herramientasParaAnthropic(audios: AudioMary[] = []) {
  const base = toolDefinitions.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
  const extra = definicionProponerAudio(audios);
  return extra ? [...base, extra] : base;
}
```

`pedirAnthropic(system, messages, apiKey, audios)` pasa `tools: herramientasParaAnthropic(audios)`, y `responderEnsayo(turnos, audios: AudioMary[] = [])` propaga `audios` tanto a `pedirAnthropic` como a `simularHerramienta(uso.name, uso.input ?? {}, audios)`.

- [ ] **Step 3: La API le pasa los audios** — `src/app/api/ensayo/route.ts`

```ts
    const r = await responderEnsayo(aTurnos(listEnsayoMensajes()), listAudiosMary());
```

(añadir `listAudiosMary` al import de `@/lib/db`).

- [ ] **Step 4: Verificar y commitear**

Run: `npm run test:entrenamiento && npm run test:ensayo && npm run test:cerebro && npm run typecheck && npm run build` → verdes.

```bash
git add src/lib/ensayo.ts src/app/api/ensayo/route.ts scripts/test-entrenamiento.ts
git commit -m "feat(ensayo): el bot propone un audio de Mary sin mandarlo"
```

---

### Task 5: "Descargar todo" — lo que leemos nosotros

**Files:**
- Create: `src/app/api/ensayo/descargar/route.ts`
- Modify: `src/app/ensayo/page.tsx` (botón en la cabecera)
- Modify: `scripts/test-entrenamiento.ts`

**Interfaces:**
- Consumes: `listEnsayoTodo()` (Task 1), `listAudiosMary()` (Task 3).
- Produces: `armarInforme(mensajes: EnsayoMensaje[], audios: AudioMary[]): string` — exportada desde `src/lib/ensayo.ts` para poder testearla sin HTTP.

- [ ] **Step 1: Test que falla**

```ts
console.log("\n— Descargar todo: la tarde entera en un archivo —");
const informe = armarInforme(listEnsayoTodo(), listAudiosMary());
check("trae las preguntas y respuestas", informe.includes("Hola, cuánto cuesta"));
check("trae las correcciones de Mary", informe.includes("pregunto la edad") || informe.includes("Tú dirías"));
check("separa por práctica", informe.includes("Práctica 1"));
check("lista los audios con su cuándo usarlo", informe.includes("CUÁNDO USARLO") || informe.includes("cuándo usarlo"));
```

- [ ] **Step 2: `armarInforme` en `src/lib/ensayo.ts`**

```ts
import type { EnsayoMensaje } from "./db";

/** La tarde entera en texto plano: es lo que leemos para armar el cerebro definitivo. */
export function armarInforme(mensajes: EnsayoMensaje[], audios: AudioMary[]): string {
  const l: string[] = ["ENTRENAMIENTO DEL BOT DE ARTELUK", ""];
  let sesion = -1;
  for (const m of mensajes) {
    if (m.sesion_id !== sesion) {
      sesion = m.sesion_id;
      l.push("", `── Práctica ${sesion} ──`, "");
    }
    l.push(`${m.rol === "apoderado" ? "MARY (haciendo de apoderado)" : "BOT"}: ${m.texto || "(no contestó nada)"}`);
    if (m.acciones) {
      try { for (const a of JSON.parse(m.acciones) as string[]) l.push(`   [${a}]`); } catch { /* acciones ilegibles: se omiten */ }
    }
    if (m.malo) l.push("   ⚠️ Mary marcó: esto yo no lo diría");
    if (m.correccion) l.push(`   ✏️ Tú dirías: ${m.correccion}`);
    if (m.correccion_audio) l.push(`   🎤 Lo dijo hablando: ${m.correccion_audio} (${m.correccion_seg ?? 0} s)`);
  }
  l.push("", "", "── AUDIOS DE MARY ──", "");
  if (!audios.length) l.push("(todavía no grabó ninguno)");
  for (const a of audios) {
    l.push(`• "${a.titulo}" — archivo ${a.archivo} (${a.segundos} s)`);
    l.push(`  CUÁNDO USARLO (palabras de Mary): ${a.cuando_usarlo || "no lo escribió"}`);
  }
  return l.join("\n");
}
```

Run: `npx tsx scripts/test-entrenamiento.ts` → PASS.

- [ ] **Step 3: Endpoint** — `src/app/api/ensayo/descargar/route.ts`

```ts
import { NextResponse } from "next/server";
import { listEnsayoTodo, listAudiosMary } from "@/lib/db";
import { armarInforme } from "@/lib/ensayo";

export const dynamic = "force-dynamic";

export async function GET() {
  const texto = armarInforme(listEnsayoTodo(), listAudiosMary());
  return new NextResponse(texto, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="entrenamiento-arteluk.txt"',
    },
  });
}
```

- [ ] **Step 4: Botón** — en la cabecera de `src/app/ensayo/page.tsx`

```tsx
            <a href="/api/ensayo/descargar" download
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#008069', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <Download size={14} /> Descargar todo
            </a>
```

(agregar `Download` al import de `lucide-react`).

- [ ] **Step 5: Verificación final de verdad, no solo tests**

1. `npm run test:entrenamiento && npm run test:ensayo && npm run test:cerebro && npm run test:db && npm run typecheck && npm run build`
2. Levantar el panel: `PANEL_PASSWORD=humo123 PORT=3002 npm run start` (si el puerto está ocupado, matar el PID: `Get-NetTCPConnection -LocalPort 3002`).
3. Por HTTP, con sesión iniciada: escribir 2 mensajes en `/ensayo`, corregir uno, apretar **Empezar de nuevo**, y comprobar en la base que **las filas siguen ahí** con su `sesion_id` anterior (`listEnsayoTodo().length`). Es la prueba que más importa.
4. `GET /api/ensayo/descargar` devuelve la tarde entera, correcciones incluidas.
5. Ventana de teléfono (390×844) para ver que los botones nuevos no se salen.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ensayo.ts src/app/api/ensayo/descargar src/app/ensayo/page.tsx scripts/test-entrenamiento.ts
git commit -m "feat(ensayo): descargar la tarde entera de entrenamiento"
```

---

## Lo que este plan NO hace (a propósito, decisión de Lukas)

- El bot **no manda audios solo** en WhatsApp real: el camino `derivarHumano` + audio propuesto queda para cuando el bot se encienda de verdad.
- El cerebro (`prompts/negocio.md`) **no se reentrena solo** con las correcciones: las aplicamos nosotros después de leerlas.
- **No se transcriben** los audios de Mary.
- No se toca `src/lib/baileys/` ni el handler de WhatsApp.
