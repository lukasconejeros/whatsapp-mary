# Asistente (chat con IA en la app) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a la app `whatsapp-mary` una pantalla `/asistente` con chat (texto + audio) donde Mary registra gastos/ingresos y hace preguntas de finanzas y calendario, resuelto por **una sola llamada** a Claude Haiku con contexto, sin Telegram ni n8n.

**Architecture:** Todo dentro de Next.js. El audio se transcribe con OpenAI Whisper (endpoint dedicado), el texto se procesa con una única llamada a Claude Haiku (Anthropic directo) que decide entre **registrar** un movimiento (reusa `addMovimiento`) o **responder** una pregunta usando contexto del mes (movimientos + ingresos + costos + clases + clientes). El historial se persiste en una tabla nueva `chat_mensajes`. La UI es una página cliente con burbujas, caja de texto y botón de micrófono (`MediaRecorder`).

**Tech Stack:** Next.js 16 / React 19 / TypeScript, better-sqlite3 (SQLite WAL), OpenAI Whisper (`whisper-1`), Anthropic Claude Haiku (`claude-haiku-4-5-20251001`), `npx tsx` para tests de script.

## Global Constraints

- No tocar `src/lib/baileys/` (resultado de 10+ lecciones; no optimizar ni simplificar).
- No modificar `src/` por petición conversacional ajena a esta feature; aquí sí editamos `src/` porque es desarrollo planificado.
- Imports web-bundled (db.ts y lo que arrastre a componentes/rutas) **sin extensión** (`./phone`, no `./phone.js`) — Turbopack no resuelve `.js`.
- Montos en **CLP entero**. Interpretación chilena: "5 lucas"=5000, "X mil"=X*1000, "un palo"/"una palo"=1.000.000; **nunca** convertir 'mil' a millones.
- Modelos: Whisper `whisper-1`; Haiku `claude-haiku-4-5-20251001` vía Anthropic directo (`x-api-key` + `anthropic-version: 2023-06-01`). **No** usar OpenRouter ni modelos `:free`.
- Claves desde env: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Local en `.env.local`. Nunca imprimir secretos en chat.
- Tono: español chileno con tuteo (nunca voseo).
- `npm run typecheck` sin errores **nuevos** sobre el baseline de 4 (ai.ts×3, baileys/client.ts×1).
- Cross-platform (Mac y Windows): nada de shell-only (`cp`/`rm`/`&&`/`mkdir` de bash) en código o scripts del repo.

---

### Task 1: Tabla `chat_mensajes` + funciones de DB

**Files:**
- Modify: `src/lib/db.ts` (añadir al `SCHEMA` string antes de su cierre en ~`:177`, y añadir funciones tras `deleteMovimiento` en ~`:724`)
- Test: `scripts/test-chat-mensajes.ts` (crear)

**Interfaces:**
- Consumes: patrón `ctx().db.prepare(...)` ya usado en db.ts; `Math.round` no aplica.
- Produces:
  - `export interface ChatMensaje { id: number; rol: 'user' | 'asistente'; texto: string; created_at: number }`
  - `export function addChatMensaje(rol: 'user' | 'asistente', texto: string): number`
  - `export function listChatMensajes(limit?: number): ChatMensaje[]` — devuelve en **orden cronológico ascendente** (más antiguo primero), tomando los últimos `limit` (default 50).

- [ ] **Step 1: Escribir el test que falla**

Crear `scripts/test-chat-mensajes.ts`:

```ts
import { addChatMensaje, listChatMensajes } from "../src/lib/db";

let fails = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) fails++;
}

addChatMensaje("user", "hola");
addChatMensaje("asistente", "¡hola! ¿en qué te ayudo?");
const all = listChatMensajes();

check("hay al menos 2 mensajes", all.length >= 2);
const lastTwo = all.slice(-2);
check("orden cronológico: user antes que asistente", lastTwo[0].rol === "user" && lastTwo[1].rol === "asistente");
check("guarda el texto", lastTwo[0].texto === "hola");
check("rol válido", lastTwo[1].rol === "asistente");

const limited = listChatMensajes(1);
check("limit recorta a 1", limited.length === 1);
check("limit devuelve el más reciente", limited[0].texto === "¡hola! ¿en qué te ayudo?");

console.log(fails === 0 ? "\nTODOS OK" : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd c:/Users/lukas/conejeros-lab/whatsapp-mary && npx tsx scripts/test-chat-mensajes.ts`
Expected: FALLA con error de importación / `addChatMensaje is not a function` (aún no existe).

- [ ] **Step 3: Añadir la tabla al SCHEMA**

En `src/lib/db.ts`, dentro del template string `SCHEMA`, justo después del bloque `movimientos` (tras `CREATE INDEX ... idx_movimientos_fecha ...` en ~`:176`) y antes del backtick de cierre `` ` `` en `:177`, añadir:

```sql

CREATE TABLE IF NOT EXISTS chat_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rol TEXT NOT NULL CHECK(rol IN ('user','asistente')),
  texto TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_created ON chat_mensajes(created_at);
```

- [ ] **Step 4: Añadir las funciones**

En `src/lib/db.ts`, después de `deleteMovimiento` (~`:724`), añadir:

```ts

// ── Chat del Asistente (IA en la app) ─────────────────────────────────────

export interface ChatMensaje {
  id: number; rol: "user" | "asistente"; texto: string; created_at: number;
}

export function addChatMensaje(rol: "user" | "asistente", texto: string): number {
  const r = ctx().db
    .prepare("INSERT INTO chat_mensajes (rol, texto) VALUES (?,?)")
    .run(rol, texto);
  return r.lastInsertRowid as number;
}

export function listChatMensajes(limit = 50): ChatMensaje[] {
  const rows = ctx().db
    .prepare("SELECT * FROM chat_mensajes ORDER BY id DESC LIMIT ?")
    .all(limit) as ChatMensaje[];
  return rows.reverse();
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd c:/Users/lukas/conejeros-lab/whatsapp-mary && npx tsx scripts/test-chat-mensajes.ts`
Expected: `TODOS OK`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts scripts/test-chat-mensajes.ts
git commit -m "feat(asistente): tabla chat_mensajes + addChatMensaje/listChatMensajes"
```

---

### Task 2: Lógica IA en `src/lib/asistente.ts`

**Files:**
- Create: `src/lib/asistente.ts`
- Create: `scripts/test-asistente-parse.ts`

**Interfaces:**
- Consumes: `listMovimientos`, `listIngresos`, `listCostos`, `listClases`, `listClientes` de `../lib/db` (sin extensión); `monthSantiago` de `./fechas`.
- Produces:
  - `export interface AccionIA { accion: 'registrar' | 'responder'; tipo?: 'gasto' | 'ingreso'; monto?: number; categoria?: string; descripcion?: string; respuesta: string }`
  - `export function parseAccionIA(raw: string): AccionIA` — parsea el JSON que devuelve Haiku, tolerando texto/fences alrededor; si no hay JSON válido o falta `respuesta`, devuelve `{ accion: 'responder', respuesta: raw.trim() || 'No te entendí, ¿me lo repites?' }`.
  - `export function construirContexto(mes?: string): string` — arma un bloque de texto con movimientos/ingresos/costos/clases/clientes del mes.
  - `export async function transcribirAudio(buffer: Buffer, filename?: string): Promise<string>` — OpenAI Whisper.
  - `export async function procesarMensaje(texto: string): Promise<AccionIA>` — 1 llamada a Haiku con contexto, devuelve `parseAccionIA(...)`.

- [ ] **Step 1: Escribir el test que falla (parser puro — sin red)**

Crear `scripts/test-asistente-parse.ts`:

```ts
import { parseAccionIA } from "../src/lib/asistente";

let fails = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) fails++;
}

const a = parseAccionIA('{"accion":"registrar","tipo":"gasto","monto":5000,"categoria":"Materiales","descripcion":"pinturas","respuesta":"Anotado: gasto de $5.000 en pinturas."}');
check("registrar: accion", a.accion === "registrar");
check("registrar: tipo", a.tipo === "gasto");
check("registrar: monto entero", a.monto === 5000);
check("registrar: respuesta", a.respuesta.includes("Anotado"));

const fenced = parseAccionIA('```json\n{"accion":"responder","respuesta":"Este mes llevas $50.000 en ingresos."}\n```');
check("responder con fences", fenced.accion === "responder" && fenced.respuesta.includes("50.000"));

const surrounded = parseAccionIA('Claro: {"accion":"responder","respuesta":"ok"} listo');
check("JSON rodeado de texto", surrounded.accion === "responder" && surrounded.respuesta === "ok");

const broken = parseAccionIA("no es json para nada");
check("fallback: accion responder", broken.accion === "responder");
check("fallback: usa el texto crudo", broken.respuesta === "no es json para nada");

const empty = parseAccionIA("   ");
check("fallback vacío: mensaje por defecto", empty.respuesta.length > 0);

console.log(fails === 0 ? "\nTODOS OK" : `\n${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd c:/Users/lukas/conejeros-lab/whatsapp-mary && npx tsx scripts/test-asistente-parse.ts`
Expected: FALLA — `Cannot find module '../src/lib/asistente'`.

- [ ] **Step 3: Crear `src/lib/asistente.ts`**

```ts
import { listMovimientos, listIngresos, listCostos, listClases, listClientes } from "./db";
import { monthSantiago, nowSantiago } from "./fechas";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface AccionIA {
  accion: "registrar" | "responder";
  tipo?: "gasto" | "ingreso";
  monto?: number;
  categoria?: string;
  descripcion?: string;
  respuesta: string;
}

export function parseAccionIA(raw: string): AccionIA {
  const fallback: AccionIA = {
    accion: "responder",
    respuesta: raw.trim() || "No te entendí, ¿me lo repites?",
  };
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return fallback;
  }
  const respuesta = typeof obj.respuesta === "string" ? obj.respuesta : "";
  if (!respuesta) return fallback;
  if (obj.accion === "registrar") {
    return {
      accion: "registrar",
      tipo: obj.tipo === "ingreso" ? "ingreso" : "gasto",
      monto: Math.round(Number(obj.monto) || 0),
      categoria: typeof obj.categoria === "string" ? obj.categoria : undefined,
      descripcion: typeof obj.descripcion === "string" ? obj.descripcion : undefined,
      respuesta,
    };
  }
  return { accion: "responder", respuesta };
}

export function construirContexto(mes = monthSantiago()): string {
  const movs = listMovimientos({ mes });
  const ingresos = listIngresos(mes);
  const costos = listCostos(mes);
  const clases = listClases();
  const clientes = listClientes();

  const lineas: string[] = [];
  lineas.push(`MES: ${mes}`);
  lineas.push("");
  lineas.push("MOVIMIENTOS (caja del asistente):");
  for (const m of movs) {
    lineas.push(`- ${m.fecha} ${m.tipo} $${m.monto} ${m.categoria ?? ""} ${m.descripcion ?? ""}`.trim());
  }
  lineas.push("");
  lineas.push("INGRESOS (finanzas):");
  for (const i of ingresos) lineas.push(`- ${JSON.stringify(i)}`);
  lineas.push("");
  lineas.push("COSTOS (finanzas):");
  for (const c of costos) lineas.push(`- ${JSON.stringify(c)}`);
  lineas.push("");
  lineas.push("CLASES (calendario):");
  for (const cl of clases) {
    lineas.push(`- ${cl.dia} ${cl.profe} ${cl.hora ?? ""} alumnos:${cl.alumnos.join(", ")} ${cl.nota ?? ""}`.trim());
  }
  lineas.push("");
  lineas.push("CLIENTES:");
  for (const cliente of clientes) {
    lineas.push(`- ${cliente.nombre ?? "(sin nombre)"} tel:${cliente.telefono} horario:${cliente.horario.join(", ")}`);
  }
  return lineas.join("\n");
}

const SYSTEM = `Eres el asistente de finanzas y calendario de Mary, que tiene una academia de arte (Arteluk) en Chile. Hablas en español chileno con tuteo, cálido y breve.

Tu trabajo es DOS cosas:
1) REGISTRAR un gasto o ingreso cuando Mary te lo cuenta (ej: "gasté 5 lucas en pinturas", "me pagaron 30 mil de la clase").
2) RESPONDER preguntas sobre finanzas (gastos, ingresos, saldo, por categoría) y calendario (clases, profes, alumnos) usando SOLO los datos del CONTEXTO. Si el dato no está en el contexto, dilo con honestidad; nunca inventes cifras.

INTERPRETACIÓN DE MONTOS CHILENOS (en pesos CLP, número entero):
- "5 lucas" o "5 luca" = 5000
- "X mil" = X * 1000 (ej: "30 mil" = 30000)
- "un palo" / "1 palo" = 1000000
- NUNCA conviertas "mil" en millones. "5 mil" son 5000, no 5.000.000.

Si el mensaje NO es claramente un gasto/ingreso (saludo, pregunta, charla), NO registres nada: responde.

Devuelve SIEMPRE y SOLO un JSON (sin texto antes ni después), con una de estas dos formas:
- Para registrar: {"accion":"registrar","tipo":"gasto"|"ingreso","monto":<entero>,"categoria":"<corta>","descripcion":"<breve>","respuesta":"<confirmación cálida y breve>"}
- Para responder: {"accion":"responder","respuesta":"<respuesta breve usando solo el contexto>"}`;

export async function procesarMensaje(texto: string, mes = monthSantiago()): Promise<AccionIA> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY");
  const contexto = construirContexto(mes);
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        { role: "user", content: `CONTEXTO:\n${contexto}\n\nMENSAJE DE MARY (fecha ${nowSantiago().slice(0, 10)}):\n${texto}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  const raw = data.content?.[0]?.text ?? "";
  return parseAccionIA(raw);
}

export async function transcribirAudio(buffer: Buffer, filename = "audio.webm"): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY");
  const form = new FormData();
  form.append("file", new Blob([buffer]), filename);
  form.append("model", "whisper-1");
  form.append("language", "es");
  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
```

> Nota: si `nowSantiago` no existe en `src/lib/fechas.ts`, sustituir su uso por `todaySantiago()` (que sí existe). Verificar antes con: `grep -n "export function" src/lib/fechas.ts`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd c:/Users/lukas/conejeros-lab/whatsapp-mary && npx tsx scripts/test-asistente-parse.ts`
Expected: `TODOS OK`, exit 0.

- [ ] **Step 5: Verificar typecheck sin errores nuevos**

Run: `cd c:/Users/lukas/conejeros-lab/whatsapp-mary && npm run typecheck`
Expected: solo los 4 errores baseline (ai.ts×3, baileys/client.ts×1); ninguno en `asistente.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/asistente.ts scripts/test-asistente-parse.ts
git commit -m "feat(asistente): lib IA (parse, contexto, Whisper, Haiku)"
```

---

### Task 3: Endpoints `/api/asistente` y `/api/asistente/transcribir`

**Files:**
- Create: `src/app/api/asistente/route.ts` (GET historial + POST procesar)
- Create: `src/app/api/asistente/transcribir/route.ts` (POST audio→texto)
- Test: smoke manual con `curl` (las llamadas a IA dependen de red/claves, no se unit-testean)

**Interfaces:**
- Consumes: `addChatMensaje`, `listChatMensajes`, `addMovimiento` de `@/lib/db`; `procesarMensaje`, `transcribirAudio` de `@/lib/asistente`; `nowSantiago` de `@/lib/fechas`.
- Produces:
  - `GET /api/asistente` → `{ ok: true, mensajes: ChatMensaje[] }`
  - `POST /api/asistente` body `{ texto: string, origen?: 'texto'|'audio' }` → `{ ok: true, respuesta: string, registrado: boolean }`
  - `POST /api/asistente/transcribir` multipart `file` → `{ ok: true, texto: string }`

- [ ] **Step 1: Crear `src/app/api/asistente/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { addChatMensaje, listChatMensajes, addMovimiento } from "@/lib/db";
import { procesarMensaje } from "@/lib/asistente";
import { nowSantiago } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, mensajes: listChatMensajes(50) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { texto?: string; origen?: string };
  const texto = (body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ ok: false, error: "texto vacío" }, { status: 400 });
  const origen = body.origen === "audio" ? "audio" : "texto";

  addChatMensaje("user", texto);
  let accion;
  try {
    accion = await procesarMensaje(texto);
  } catch (e) {
    const msg = "Uy, no pude pensar la respuesta ahora. Intenta de nuevo en un ratito.";
    addChatMensaje("asistente", msg);
    return NextResponse.json({ ok: false, respuesta: msg, error: String(e) }, { status: 502 });
  }

  let registrado = false;
  if (accion.accion === "registrar" && accion.monto && accion.monto > 0 && accion.tipo) {
    addMovimiento({
      fecha: nowSantiago(),
      tipo: accion.tipo,
      monto: accion.monto,
      categoria: accion.categoria,
      descripcion: accion.descripcion,
      origen,
    });
    registrado = true;
  }

  addChatMensaje("asistente", accion.respuesta);
  return NextResponse.json({ ok: true, respuesta: accion.respuesta, registrado });
}
```

> Nota: si `nowSantiago` no existe, usar `todaySantiago()` (la columna `fecha` de movimientos es TEXT; ambos formatos sirven, pero mantener consistencia con `/api/movimientos`). Verificar qué usa `src/app/api/movimientos/route.ts` y copiar ese mismo helper.

- [ ] **Step 2: Crear `src/app/api/asistente/transcribir/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { transcribirAudio } from "@/lib/asistente";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "falta el archivo" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const texto = await transcribirAudio(buffer, "audio.webm");
    return NextResponse.json({ ok: true, texto });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verificar typecheck sin errores nuevos**

Run: `cd c:/Users/lukas/conejeros-lab/whatsapp-mary && npm run typecheck`
Expected: solo los 4 baseline; ninguno en las rutas nuevas.

- [ ] **Step 4: Smoke test del POST de texto (servidor local)**

Arrancar el server web en otra terminal: `npm run dev` (necesita `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` en `.env.local`).
Luego:

Run:
```bash
curl -s -X POST http://localhost:3002/api/asistente -H "Content-Type: application/json" -d '{"texto":"gaste 5 lucas en pinturas"}'
```
Expected: JSON `{"ok":true,"respuesta":"...","registrado":true}` y la respuesta confirma ~$5.000 (no $5.000.000).

Run (verificar que quedó en la Caja):
```bash
curl -s "http://localhost:3002/api/movimientos?mes=$(date +%Y-%m)"
```
Expected: aparece un movimiento `tipo:"gasto"`, `monto:5000`, `origen:"texto"`.

Run (pregunta de contexto):
```bash
curl -s -X POST http://localhost:3002/api/asistente -H "Content-Type: application/json" -d '{"texto":"cuanto llevo gastado este mes?"}'
```
Expected: `registrado:false` y `respuesta` con una cifra coherente con la Caja.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/asistente
git commit -m "feat(asistente): endpoints POST/GET /api/asistente + transcribir"
```

---

### Task 4: Pantalla `/asistente` + ítem en el menú

**Files:**
- Create: `src/app/asistente/page.tsx`
- Modify: `src/components/AppNav.tsx:6,8-13` (import de icono + nuevo ítem)
- Test: build + verificación visual manual

**Interfaces:**
- Consumes: `GET /api/asistente`, `POST /api/asistente`, `POST /api/asistente/transcribir`.
- Produces: ruta navegable `/asistente` con chat funcional (texto + micrófono).

- [ ] **Step 1: Añadir el ítem "Asistente" al menú**

En `src/components/AppNav.tsx`, línea 6, añadir `MessageCircle` al import de `lucide-react`:

```tsx
import { Columns3, Wallet, CalendarDays, Plug, MessageCircle } from 'lucide-react'
```

Y en el array `items` (líneas 8-13), añadir el ítem tras Calendario:

```tsx
const items = [
  { href: '/inbox',      Icon: Columns3,      label: 'Embudo'     },
  { href: '/finanzas',   Icon: Wallet,        label: 'Finanzas'   },
  { href: '/calendario', Icon: CalendarDays,  label: 'Calendario' },
  { href: '/asistente',  Icon: MessageCircle, label: 'Asistente'  },
  { href: '/conexion',   Icon: Plug,          label: 'Conexión'   },
]
```

- [ ] **Step 2: Crear `src/app/asistente/page.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AppNav from '@/components/AppNav'
import { Send, Mic, Square } from 'lucide-react'

type Msg = { id: number; rol: 'user' | 'asistente'; texto: string }

export default function AsistentePage() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const finRef = useRef<HTMLDivElement | null>(null)

  const cargar = useCallback(async () => {
    const d = await fetch('/api/asistente').then(r => r.json())
    if (d.ok) setMsgs(d.mensajes)
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando])

  async function enviar(t: string, origen: 'texto' | 'audio' = 'texto') {
    const limpio = t.trim()
    if (!limpio || pensando) return
    setTexto('')
    setMsgs(m => [...m, { id: Date.now(), rol: 'user', texto: limpio }])
    setPensando(true)
    try {
      const d = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: limpio, origen }),
      }).then(r => r.json())
      setMsgs(m => [...m, { id: Date.now() + 1, rol: 'asistente', texto: d.respuesta ?? 'No pude responder.' }])
    } finally {
      setPensando(false)
    }
  }

  async function toggleMic() {
    if (grabando) {
      recRef.current?.stop()
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream)
    chunksRef.current = []
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      setGrabando(false)
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const form = new FormData()
      form.append('file', blob, 'audio.webm')
      setPensando(true)
      try {
        const d = await fetch('/api/asistente/transcribir', { method: 'POST', body: form }).then(r => r.json())
        if (d.ok && d.texto) {
          await enviar(d.texto, 'audio')
        } else {
          setMsgs(m => [...m, { id: Date.now(), rol: 'asistente', texto: 'No te escuché bien, ¿lo intentas de nuevo?' }])
        }
      } finally {
        setPensando(false)
      }
    }
    rec.start()
    recRef.current = rec
    setGrabando(true)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FDF2F8' }}>
      <AppNav />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <header style={{ padding: '18px 20px', borderBottom: '1px solid #FBCFE8' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#831843' }}>Asistente</h1>
          <p style={{ fontSize: 12, color: '#9D5577' }}>Cuéntame tus gastos e ingresos o pregúntame por la plata y el calendario.</p>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.map(m => (
            <div key={m.id} style={{ alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', background: m.rol === 'user' ? '#EC4899' : '#fff', color: m.rol === 'user' ? '#fff' : '#374151', border: m.rol === 'user' ? 'none' : '1px solid #FBCFE8', borderRadius: 14, padding: '9px 13px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {m.texto}
            </div>
          ))}
          {pensando && <div style={{ alignSelf: 'flex-start', color: '#B57795', fontSize: 12, fontStyle: 'italic' }}>escribiendo…</div>}
          <div ref={finRef} />
        </div>

        <form onSubmit={e => { e.preventDefault(); enviar(texto) }} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #FBCFE8' }}>
          <button type="button" onClick={toggleMic} title={grabando ? 'Detener' : 'Grabar audio'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: grabando ? '#DC2626' : '#FBCFE8', color: grabando ? '#fff' : '#831843' }}>
            {grabando ? <Square size={18} /> : <Mic size={18} />}
          </button>
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe aquí…" style={{ flex: 1, borderRadius: 12, border: '1px solid #FBCFE8', padding: '0 14px', fontSize: 13, outline: 'none' }} />
          <button type="submit" disabled={pensando || !texto.trim()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#EC4899', color: '#fff', opacity: pensando || !texto.trim() ? 0.5 : 1 }}>
            <Send size={18} />
          </button>
        </form>
      </main>
    </div>
  )
}
```

> Nota: revisar `src/app/finanzas/page.tsx` o `src/app/calendario/page.tsx` para confirmar el patrón de layout con `AppNav` (si envuelven en un contenedor distinto, igualarlo). No inventar estilos fuera de la paleta rosa ya usada (`#FDF2F8`, `#FBCFE8`, `#EC4899`, `#831843`, `#9D5577`).

- [ ] **Step 3: Verificar typecheck sin errores nuevos**

Run: `cd c:/Users/lukas/conejeros-lab/whatsapp-mary && npm run typecheck`
Expected: solo los 4 baseline.

- [ ] **Step 4: Verificación visual manual**

Con `npm run dev` corriendo, abrir `http://localhost:3002/asistente`.
Comprobar:
- El menú muestra "Asistente" y navega a la pantalla.
- Se ven los mensajes previos (los del smoke test de Task 3).
- Escribir "me pagaron 30 mil de una clase" → responde confirmando ~$30.000 y aparece en Finanzas → Caja como ingreso.
- Botón micrófono pide permiso, graba, y al detener transcribe y manda el mensaje.

- [ ] **Step 5: Commit**

```bash
git add src/app/asistente/page.tsx src/components/AppNav.tsx
git commit -m "feat(asistente): pantalla /asistente (chat texto+audio) + ítem en menú"
```

---

## Notas de despliegue (fuera del alcance de construir/probar local)

- Producción está **bloqueada** hasta que Lukas entregue un **token de GitHub nuevo** (el anterior murió con 401). El commit `d58ef68` (endpoint contexto + DELETE movimiento + botón borrar en Caja) está local sin pushear; se empuja junto con esta feature cuando haya token.
- En EasyPanel agregar variables de entorno: `OPENAI_API_KEY` y `ANTHROPIC_API_KEY`.
- Tras desplegar: smoke test en la URL de prod (texto + audio) y limpiar movimientos de prueba basura en prod ($5M Pinturas y entradas de $0).
