import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { normalizeChilePhone } from "./phone";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "messages.db");

export type ConversationMode = "AI" | "HUMAN";
export type MessageRole = "user" | "assistant" | "human";
export type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";
// Estado del embudo (independiente de mode). 'derivado' se deriva de mode=HUMAN.
export type ConversationEstado = "activo" | "agendado" | "resuelto" | "cancelado";
// Categoría de contacto: la columna del embudo de la app de Mary.
export type Categoria = "mary" | "arteluk" | "potencial";

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  jid: string | null;
  mode: ConversationMode;
  estado: ConversationEstado;
  categoria: Categoria;
  categoria_manual: number; // 0 | 1 — si la usuaria la movió a mano
  ctwa_referral: string | null; // JSON de la señal de anuncio, o null
  last_message_at: number | null;
  created_at: number;
  photo?: string | null; // foto de perfil (archivo local o URL); vacío = avatar gris
}

export interface ConversationListItem extends Conversation {
  last_message_preview: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  created_at: number;
  media?: string | null; // nombre del archivo de foto/audio guardado (data/media/<name>), si lo hay
}

export interface ConnectionState {
  id: number;
  status: ConnectionStatus;
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  kind: "text" | "image" | "audio"; // image/audio → media es el archivo a enviar
  media: string | null;   // nombre del archivo en data/media (para image/audio)
  sent: number;
  created_at: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  jid TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'HUMAN',
  estado TEXT NOT NULL DEFAULT 'activo',
  categoria TEXT NOT NULL DEFAULT 'mary',
  categoria_manual INTEGER NOT NULL DEFAULT 0,
  ctwa_referral TEXT,
  last_message_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS connection_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected')) NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  media TEXT,
  sent INTEGER NOT NULL DEFAULT 0,   -- 0=pendiente, 1=enviado, 2=fallido (descartado)
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(sent, created_at);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id),
  phone TEXT NOT NULL,
  nombre TEXT,
  negocio TEXT,
  facturacion TEXT,
  dolor TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado, created_at);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefono TEXT UNIQUE NOT NULL,
  nombre TEXT,
  airtable_id TEXT,
  email TEXT,
  estado TEXT,
  horario TEXT,
  alumnos TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_clientes_tel ON clientes(telefono);

CREATE TABLE IF NOT EXISTS ingresos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  apoderado TEXT,
  monto INTEGER NOT NULL DEFAULT 0,
  tipo TEXT,
  detalle TEXT,
  airtable_id TEXT UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha);

CREATE TABLE IF NOT EXISTS costos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT,
  cantidad REAL,
  valor INTEGER NOT NULL DEFAULT 0,
  notas TEXT,
  airtable_id TEXT UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_costos_fecha ON costos(fecha);

CREATE TABLE IF NOT EXISTS clases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dia TEXT NOT NULL,
  profe TEXT NOT NULL,
  hora TEXT,
  alumnos TEXT,
  nota TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_clases_dia ON clases(dia);

CREATE TABLE IF NOT EXISTS movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('gasto','ingreso')),
  monto INTEGER NOT NULL DEFAULT 0,
  categoria TEXT,
  descripcion TEXT,
  origen TEXT,
  chat_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);

CREATE TABLE IF NOT EXISTS chat_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rol TEXT NOT NULL CHECK(rol IN ('user','asistente')),
  texto TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_created ON chat_mensajes(created_at);

-- Feedbacks/felicitaciones que Mary manda a los apoderados desde el Asistente.
-- estado: 'borrador' (esperando confirmación) | 'ambiguo' (varios candidatos) |
--         'sin_destinatario' (no se encontró) | 'enviado' | 'cancelado'.
CREATE TABLE IF NOT EXISTS feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destinatario TEXT,          -- término que Mary usó ("Amparo", "la mamá de Amparo")
  cliente_telefono TEXT,      -- resuelto (si hay 1 match)
  cliente_nombre TEXT,        -- nombre del apoderado resuelto
  mensaje TEXT NOT NULL,      -- texto que se le manda al apoderado
  fotos TEXT,                 -- JSON array de nombres de archivo en data/media
  estado TEXT NOT NULL DEFAULT 'borrador',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_feedbacks_estado ON feedbacks(estado, created_at);

-- Suscripciones de Web Push (a qué dispositivos avisar).
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

interface Ctx {
  db: InstanceType<typeof Database>;
  getConvByPhone: Database.Statement<unknown[]>;
  insertConv: Database.Statement<unknown[]>;
  updateConvName: Database.Statement<unknown[]>;
  updateConvJid: Database.Statement<unknown[]>;
  getConvById: Database.Statement<unknown[]>;
  listConvs: Database.Statement<unknown[]>;
  setModeStmt: Database.Statement<unknown[]>;
  insertMsg: Database.Statement<unknown[]>;
  updateLastMsg: Database.Statement<unknown[]>;
  getMsgs: Database.Statement<unknown[]>;
  getConnState: Database.Statement<unknown[]>;
  upsertConnState: Database.Statement<unknown[]>;
  enqueueOutboxStmt: Database.Statement<unknown[]>;
  getPendingOutboxStmt: Database.Statement<unknown[]>;
  markSentStmt: Database.Statement<unknown[]>;
  deleteMsgs: Database.Statement<unknown[]>;
  deleteOutbox: Database.Statement<unknown[]>;
  deleteConv: Database.Statement<unknown[]>;
}

let _ctx: Ctx | null = null;

function ctx(): Ctx {
  if (!_ctx) _ctx = build();
  return _ctx;
}

// Agrega una columna sólo si falta, ignorando el error de "columna duplicada" que
// ocurre si otro proceso la agregó a la vez (deploy con arranque simultáneo de bot y web).
function addColumnaSiFalta(
  db: InstanceType<typeof Database>,
  tabla: string,
  col: string,
  definicion: string
): void {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[];
  if (cols.some((c) => c.name === col)) return;
  try {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${definicion}`);
  } catch (e) {
    if (!String(e).toLowerCase().includes("duplicate column")) throw e;
  }
}

function build(): Ctx {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  // micro-migraciones IDEMPOTENTES y a prueba de doble arranque (bot + web contra la
  // misma DB tras un deploy): cada ALTER se ignora si la columna ya existe.
  addColumnaSiFalta(db, "conversations", "jid", "TEXT");
  addColumnaSiFalta(db, "conversations", "estado", "TEXT NOT NULL DEFAULT 'activo'");
  addColumnaSiFalta(db, "conversations", "categoria", "TEXT NOT NULL DEFAULT 'mary'");
  addColumnaSiFalta(db, "conversations", "categoria_manual", "INTEGER NOT NULL DEFAULT 0");
  addColumnaSiFalta(db, "conversations", "ctwa_referral", "TEXT");
  addColumnaSiFalta(db, "conversations", "photo", "TEXT");
  addColumnaSiFalta(db, "messages", "media", "TEXT");
  for (const col of ["email", "estado", "horario", "alumnos"]) addColumnaSiFalta(db, "clientes", col, "TEXT");
  addColumnaSiFalta(db, "clases", "fecha", "TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_clases_fecha ON clases(fecha)");
  addColumnaSiFalta(db, "outbox", "kind", "TEXT NOT NULL DEFAULT 'text'");
  addColumnaSiFalta(db, "outbox", "media", "TEXT");
  addColumnaSiFalta(db, "outbox", "attempts", "INTEGER NOT NULL DEFAULT 0");
  // mp_id: ID de transacción de MercadoPago (para importar cartolas sin duplicar).
  addColumnaSiFalta(db, "ingresos", "mp_id", "TEXT");
  addColumnaSiFalta(db, "costos", "mp_id", "TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_ingresos_mp ON ingresos(mp_id)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_costos_mp ON costos(mp_id)");

  return {
    db,
    getConvByPhone: db.prepare("SELECT * FROM conversations WHERE phone = ?"),
    insertConv: db.prepare(
      "INSERT INTO conversations (phone, name, jid) VALUES (?, ?, ?) RETURNING *"
    ),
    updateConvName: db.prepare(
      "UPDATE conversations SET name = ? WHERE id = ? AND (name IS NULL OR name = '')"
    ),
    updateConvJid: db.prepare("UPDATE conversations SET jid = ? WHERE id = ?"),
    getConvById: db.prepare("SELECT * FROM conversations WHERE id = ?"),
    listConvs: db.prepare(`
      SELECT c.*, (
        SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
      ) AS last_message_preview
      FROM conversations c
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    `),
    setModeStmt: db.prepare("UPDATE conversations SET mode = ? WHERE id = ?"),
    insertMsg: db.prepare(
      "INSERT INTO messages (conversation_id, role, content, media) VALUES (?, ?, ?, ?)"
    ),
    updateLastMsg: db.prepare(
      "UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?"
    ),
    getMsgs: db.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC LIMIT ?"
    ),
    getConnState: db.prepare("SELECT * FROM connection_state WHERE id = 1"),
    upsertConnState: db.prepare(
      "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1"
    ),
    enqueueOutboxStmt: db.prepare(
      "INSERT INTO outbox (conversation_id, phone, content, kind, media) VALUES (?, ?, ?, ?, ?)"
    ),
    getPendingOutboxStmt: db.prepare(
      "SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC, id ASC LIMIT ?"
    ),
    markSentStmt: db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?"),
    deleteMsgs: db.prepare("DELETE FROM messages WHERE conversation_id = ?"),
    deleteOutbox: db.prepare(
      "DELETE FROM outbox WHERE conversation_id = ? AND sent = 0"
    ),
    deleteConv: db.prepare("DELETE FROM conversations WHERE id = ?"),
  };
}

// Prefiere el JID de número real (@s.whatsapp.net) sobre el @lid para poder
// responder de forma estable. Devuelve el JID que conviene guardar.
function preferRealJid(existing: string | null, incoming?: string): string | null {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing.endsWith("@s.whatsapp.net")) return existing; // ya tenemos el número real
  if (incoming.endsWith("@s.whatsapp.net")) return incoming; // upgrade lid → número real
  return incoming;
}

// Un nombre sirve para deduplicar LID↔número solo si es suficientemente único.
// Baileys 6.7.x NO expone el mapeo LID→número, así que el pushName es la única
// señal que vincula los dos identificadores del mismo contacto.
function nameIsDedupable(name?: string): name is string {
  if (!name) return false;
  const t = name.trim();
  return t.length >= 4; // evita colisiones de saludos cortos tipo "Ana"
}

export function getOrCreateConversation(
  phone: string,
  name?: string,
  jid?: string
): Conversation {
  const c = ctx();

  // 1. Match exacto por phone (caso normal: mismo identificador de siempre)
  const byPhone = c.getConvByPhone.get(phone) as Conversation | undefined;
  if (byPhone) {
    if (name) c.updateConvName.run(name, byPhone.id);
    const newJid = preferRealJid(byPhone.jid, jid);
    if (newJid && newJid !== byPhone.jid) c.updateConvJid.run(newJid, byPhone.id);
    return c.getConvById.get(byPhone.id) as Conversation;
  }

  // 2. No existe por phone. Fusión por nombre SÓLO para el caso real @lid↔número:
  //    uno de los dos identificadores es @lid (mismo contacto, dos IDs). Dos personas
  //    DISTINTAS con el mismo pushName pero ambas con número real NO se fusionan
  //    (antes se mezclaban y las respuestas iban al número equivocado).
  if (nameIsDedupable(name)) {
    const byName = c.db
      .prepare("SELECT * FROM conversations WHERE name = ? ORDER BY id ASC LIMIT 1")
      .get(name.trim()) as Conversation | undefined;
    if (byName) {
      const incomingEsLid = !!jid && jid.endsWith("@lid");
      const existenteEsLid = !!byName.jid && byName.jid.endsWith("@lid");
      if (incomingEsLid || existenteEsLid) {
        const newJid = preferRealJid(byName.jid, jid);
        if (newJid && newJid !== byName.jid) c.updateConvJid.run(newJid, byName.id);
        return c.getConvById.get(byName.id) as Conversation;
      }
    }
  }

  // 3. Contacto nuevo de verdad
  const rows = c.insertConv.all(phone, name ?? null, jid ?? null) as Conversation[];
  return rows[0];
}

export function setEstado(conversationId: number, estado: ConversationEstado): void {
  ctx().db.prepare("UPDATE conversations SET estado = ? WHERE id = ?").run(estado, conversationId);
}

export function getConversationById(id: number): Conversation | null {
  return (ctx().getConvById.get(id) as Conversation | undefined) ?? null;
}

export function listConversations(): ConversationListItem[] {
  return ctx().listConvs.all() as ConversationListItem[];
}

export function setMode(conversationId: number, mode: ConversationMode): void {
  ctx().setModeStmt.run(mode, conversationId);
}

export function insertMessage(
  conversationId: number,
  role: MessageRole,
  content: string,
  media?: string | null
): number {
  const c = ctx();
  const insert = c.db.transaction(() => {
    const result = c.insertMsg.run(conversationId, role, content, media ?? null);
    c.updateLastMsg.run(conversationId);
    return result.lastInsertRowid as number;
  });
  return insert();
}

export function getMessages(conversationId: number, limit = 50): Message[] {
  return ctx().getMsgs.all(conversationId, limit) as Message[];
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  const c = ctx();
  const rows = c.db
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?"
    )
    .all(conversationId, limit) as Message[];
  return rows.reverse();
}

export function getConnectionState(): ConnectionState {
  return ctx().getConnState.get() as ConnectionState;
}

export function setConnectionState(input: {
  status?: ConnectionStatus;
  qr_string?: string | null;
  phone?: string | null;
}): void {
  const c = ctx();
  const current = c.getConnState.get() as ConnectionState;
  const status = input.status ?? current.status;
  const qr_string = "qr_string" in input ? input.qr_string : current.qr_string;
  const phone = "phone" in input ? input.phone : current.phone;
  c.upsertConnState.run(status, qr_string, phone);
}

export function enqueueOutbox(
  conversationId: number,
  phone: string,
  content: string,
  opts?: { kind?: "text" | "image" | "audio"; media?: string | null }
): number {
  const kind = opts?.kind ?? "text";
  const media = opts?.media ?? null;
  const result = ctx().enqueueOutboxStmt.run(conversationId, phone, content, kind, media);
  return result.lastInsertRowid as number;
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return ctx().getPendingOutboxStmt.all(limit) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  ctx().markSentStmt.run(id);
}

// Suma 1 al contador de intentos y devuelve el nuevo total (para descartar poison-pills).
export function bumpOutboxAttempt(id: number): number {
  const r = ctx()
    .db.prepare("UPDATE outbox SET attempts = attempts + 1 WHERE id = ? RETURNING attempts")
    .get(id) as { attempts: number } | undefined;
  return r?.attempts ?? 0;
}

// Marca un item como fallido/descartado (sent=2) para sacarlo de la cola.
export function markOutboxFailed(id: number): void {
  ctx().db.prepare("UPDATE outbox SET sent = 2 WHERE id = ?").run(id);
}

export function deleteConversation(conversationId: number): void {
  const c = ctx();
  const del = c.db.transaction(() => {
    c.deleteMsgs.run(conversationId);
    c.deleteOutbox.run(conversationId);
    // leads tiene FK a conversations (RESTRICT): hay que borrarlo antes o el DELETE
    // de la conversación falla con SQLITE_CONSTRAINT y el borrado nunca se completa.
    c.db.prepare("DELETE FROM leads WHERE conversation_id = ?").run(conversationId);
    c.deleteConv.run(conversationId);
  });
  del();
}

export interface Lead {
  id: number;
  conversation_id: number | null;
  phone: string;
  nombre: string | null;
  negocio: string | null;
  facturacion: string | null;
  dolor: string | null;
  estado: string;
  created_at: number;
}

export function upsertLead(data: {
  conversationId?: number;
  phone: string;
  nombre?: string;
  negocio?: string;
  facturacion?: string;
  dolor?: string;
}): void {
  const c = ctx();
  const existing = c.db
    .prepare("SELECT id FROM leads WHERE phone = ?")
    .get(data.phone) as { id: number } | undefined;

  if (existing) {
    c.db.prepare(`
      UPDATE leads SET
        nombre      = COALESCE(?, nombre),
        negocio     = COALESCE(?, negocio),
        facturacion = COALESCE(?, facturacion),
        dolor       = COALESCE(?, dolor)
      WHERE phone = ?
    `).run(
      data.nombre      ?? null,
      data.negocio     ?? null,
      data.facturacion ?? null,
      data.dolor       ?? null,
      data.phone
    );
  } else {
    c.db.prepare(`
      INSERT INTO leads (conversation_id, phone, nombre, negocio, facturacion, dolor)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.conversationId ?? null,
      data.phone,
      data.nombre      ?? null,
      data.negocio     ?? null,
      data.facturacion ?? null,
      data.dolor       ?? null
    );
  }
}

export function listLeads(estado?: string): Lead[] {
  const c = ctx();
  if (estado) {
    return c.db.prepare("SELECT * FROM leads WHERE estado = ? ORDER BY created_at DESC").all(estado) as Lead[];
  }
  return c.db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all() as Lead[];
}

// ── Categoría del embudo (app de Mary) ────────────────────────────────────

export function setCategoria(
  conversationId: number,
  categoria: Categoria,
  manual = false
): void {
  ctx().db
    .prepare("UPDATE conversations SET categoria = ?, categoria_manual = ? WHERE id = ?")
    .run(categoria, manual ? 1 : 0, conversationId);
}

export function setCtwaReferral(conversationId: number, referral: unknown): void {
  ctx().db
    .prepare("UPDATE conversations SET ctwa_referral = ? WHERE id = ?")
    .run(referral == null ? null : JSON.stringify(referral), conversationId);
}

// Guarda la foto de perfil de una conversación (archivo local o URL).
export function setConversationPhoto(id: number, photo: string): void {
  try {
    ctx().db.prepare("UPDATE conversations SET photo = ? WHERE id = ?").run(photo, id);
  } catch { /* no crítico */ }
}

// ── Clientes Arteluk (semilla desde Airtable) ─────────────────────────────

export interface Cliente {
  id: number;
  telefono: string;
  nombre: string | null;
  airtable_id: string | null;
  email: string | null;
  estado: string | null;
  horario: string | null;
  alumnos: string | null;
  created_at: number;
}

export function upsertCliente(data: {
  nombre?: string;
  telefono: string;
  airtableId?: string;
  email?: string;
  estado?: string;
  horario?: string[];
  alumnos?: string;
}): boolean {
  const tel = normalizeChilePhone(data.telefono);
  if (!tel) return false;
  ctx().db
    .prepare(`
      INSERT INTO clientes (telefono, nombre, airtable_id, email, estado, horario, alumnos)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(telefono) DO UPDATE SET
        nombre      = COALESCE(excluded.nombre, clientes.nombre),
        airtable_id = COALESCE(excluded.airtable_id, clientes.airtable_id),
        email       = COALESCE(excluded.email, clientes.email),
        estado      = COALESCE(excluded.estado, clientes.estado),
        horario     = COALESCE(excluded.horario, clientes.horario),
        alumnos     = COALESCE(excluded.alumnos, clientes.alumnos)
    `)
    .run(
      tel, data.nombre ?? null, data.airtableId ?? null, data.email ?? null,
      data.estado ?? null, data.horario ? JSON.stringify(data.horario) : null, data.alumnos ?? null
    );
  return true;
}

// Inserta un cliente SÓLO si no existe (no pisa nombre/alumnos editados a mano).
// Los nuevos quedan 'activo'. Usado por el seed que corre en cada arranque.
export function insertClienteNuevo(data: { telefono: string; nombre?: string; alumnos?: string }): void {
  const tel = normalizeChilePhone(data.telefono);
  if (!tel) return;
  ctx()
    .db.prepare(
      "INSERT INTO clientes (telefono, nombre, alumnos, estado) VALUES (?, ?, ?, 'activo') ON CONFLICT(telefono) DO NOTHING"
    )
    .run(tel, data.nombre ?? null, data.alumnos ?? null);
}

// Rellena estado='activo' sólo si estaba vacío (para clientes viejos sin estado).
export function defaultEstadoActivoSiVacio(telefono: string): void {
  const tel = normalizeChilePhone(telefono);
  if (!tel) return;
  ctx()
    .db.prepare("UPDATE clientes SET estado='activo' WHERE telefono=? AND (estado IS NULL OR estado='')")
    .run(tel);
}

// Ejecuta fn dentro de UNA sola transacción (para lotes como el seed).
export function withTransaction(fn: () => void): void {
  ctx().db.transaction(fn)();
}

export function getClienteByPhone(phone: string): Cliente | null {
  const tel = normalizeChilePhone(phone);
  if (!tel) return null;
  return (
    (ctx().db.prepare("SELECT * FROM clientes WHERE telefono = ?").get(tel) as
      | Cliente
      | undefined) ?? null
  );
}

// Normaliza texto para búsqueda/comparación: sin acentos, minúsculas, sin espacios sobrantes.
export function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Todos los contactos (clientes) con sus campos, ordenados por nombre.
export function listContactos(): Cliente[] {
  return ctx()
    .db.prepare("SELECT * FROM clientes ORDER BY nombre COLLATE NOCASE ASC")
    .all() as Cliente[];
}

// Marca un contacto como 'activo' | 'inactivo' (u otro estado libre).
export function setClienteEstado(telefono: string, estado: string): boolean {
  const tel = normalizeChilePhone(telefono);
  if (!tel) return false;
  const r = ctx()
    .db.prepare("UPDATE clientes SET estado = ? WHERE telefono = ?")
    .run(estado, tel);
  return r.changes > 0;
}

// Búsqueda difusa de clientes por nombre del apoderado o del/los alumno(s),
// ignorando acentos y mayúsculas. Usada por el flujo de feedback ("la mamá de Amparo").
// Búsqueda por LÍMITE DE PALABRA (no substring): cada palabra de la búsqueda debe
// coincidir con el inicio de alguna palabra del nombre/alumno. Así "Ana" NO matchea
// "Mariana" (evita resolver al apoderado equivocado), pero "Amparo" sí matchea
// "Amparo Coronado" y "maria ignacia" matchea "Maria Ignacia Tauler".
export function searchClientes(term: string): Cliente[] {
  const q = normalizarTexto(term);
  if (!q) return [];
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length === 0) return [];
  const rows = ctx().db.prepare("SELECT * FROM clientes").all() as Cliente[];
  return rows.filter((c) => {
    const tokens = normalizarTexto(`${c.nombre ?? ""} ${c.alumnos ?? ""}`).split(/\s+/).filter(Boolean);
    return qWords.every((qw) => tokens.some((t) => t === qw || t.startsWith(qw)));
  });
}

// ── Finanzas: ingresos y costos ───────────────────────────────────────────

export interface Ingreso {
  id: number; fecha: string; apoderado: string | null; monto: number;
  tipo: string | null; detalle: string | null; airtable_id: string | null; created_at: number;
}
export interface Costo {
  id: number; fecha: string; tipo: string | null; cantidad: number | null; valor: number;
  notas: string | null; airtable_id: string | null; created_at: number;
}

export interface IngresoInput { fecha: string; apoderado?: string; monto: number; tipo?: string; detalle?: string }
export interface CostoInput { fecha: string; tipo?: string; cantidad?: number; valor: number; notas?: string }

export function listIngresos(mes: string): Ingreso[] {
  return ctx().db
    .prepare("SELECT * FROM ingresos WHERE substr(fecha,1,7) = ? ORDER BY fecha DESC, id DESC")
    .all(mes) as Ingreso[];
}
export function addIngreso(d: IngresoInput): number {
  const r = ctx().db
    .prepare("INSERT INTO ingresos (fecha, apoderado, monto, tipo, detalle) VALUES (?,?,?,?,?)")
    .run(d.fecha, d.apoderado ?? null, Math.round(d.monto), d.tipo ?? null, d.detalle ?? null);
  return r.lastInsertRowid as number;
}
// Importa un movimiento de cartola (dedup por mp_id). Devuelve true si insertó,
// false si ya existía. tipo='MercadoPago' para distinguirlo en la lista.
export function importarIngresoCartola(d: { fecha: string; monto: number; tipo?: string; detalle?: string; mpId: string }): boolean {
  const r = ctx()
    .db.prepare("INSERT INTO ingresos (fecha, monto, tipo, detalle, mp_id) VALUES (?,?,?,?,?) ON CONFLICT(mp_id) DO NOTHING")
    .run(d.fecha, Math.round(d.monto), d.tipo ?? "MercadoPago", d.detalle ?? null, d.mpId);
  return r.changes > 0;
}
export function importarCostoCartola(d: { fecha: string; valor: number; tipo?: string; notas?: string; mpId: string }): boolean {
  const r = ctx()
    .db.prepare("INSERT INTO costos (fecha, valor, tipo, notas, mp_id) VALUES (?,?,?,?,?) ON CONFLICT(mp_id) DO NOTHING")
    .run(d.fecha, Math.round(d.valor), d.tipo ?? "MercadoPago", d.notas ?? null, d.mpId);
  return r.changes > 0;
}

// Borra TODO lo importado de cartola (mp_id no nulo). Para re-importar limpio.
export function borrarCartolaImportada(): { ingresos: number; costos: number } {
  const i = ctx().db.prepare("DELETE FROM ingresos WHERE mp_id IS NOT NULL").run();
  const c = ctx().db.prepare("DELETE FROM costos WHERE mp_id IS NOT NULL").run();
  return { ingresos: i.changes, costos: c.changes };
}

export function updateIngreso(id: number, d: IngresoInput): void {
  ctx().db
    .prepare("UPDATE ingresos SET fecha=?, apoderado=?, monto=?, tipo=?, detalle=? WHERE id=?")
    .run(d.fecha, d.apoderado ?? null, Math.round(d.monto), d.tipo ?? null, d.detalle ?? null, id);
}
export function deleteIngreso(id: number): void {
  ctx().db.prepare("DELETE FROM ingresos WHERE id=?").run(id);
}
export function upsertIngresoFromAirtable(d: IngresoInput & { airtableId: string }): void {
  ctx().db
    .prepare(`
      INSERT INTO ingresos (airtable_id, fecha, apoderado, monto, tipo, detalle)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(airtable_id) DO UPDATE SET
        fecha=excluded.fecha, apoderado=excluded.apoderado, monto=excluded.monto,
        tipo=excluded.tipo, detalle=excluded.detalle
    `)
    .run(d.airtableId, d.fecha, d.apoderado ?? null, Math.round(d.monto), d.tipo ?? null, d.detalle ?? null);
}

export function listCostos(mes: string): Costo[] {
  return ctx().db
    .prepare("SELECT * FROM costos WHERE substr(fecha,1,7) = ? ORDER BY fecha DESC, id DESC")
    .all(mes) as Costo[];
}

// Rango de fechas (desde/hasta en formato YYYY-MM-DD, inclusive) — para Métricas.
export function listIngresosRange(desde: string, hasta: string): Ingreso[] {
  return ctx().db
    .prepare("SELECT * FROM ingresos WHERE substr(fecha,1,10) BETWEEN ? AND ? ORDER BY fecha DESC, id DESC")
    .all(desde, hasta) as Ingreso[];
}
export function listCostosRange(desde: string, hasta: string): Costo[] {
  return ctx().db
    .prepare("SELECT * FROM costos WHERE substr(fecha,1,10) BETWEEN ? AND ? ORDER BY fecha DESC, id DESC")
    .all(desde, hasta) as Costo[];
}
export function addCosto(d: CostoInput): number {
  const r = ctx().db
    .prepare("INSERT INTO costos (fecha, tipo, cantidad, valor, notas) VALUES (?,?,?,?,?)")
    .run(d.fecha, d.tipo ?? null, d.cantidad ?? null, Math.round(d.valor), d.notas ?? null);
  return r.lastInsertRowid as number;
}
export function updateCosto(id: number, d: CostoInput): void {
  ctx().db
    .prepare("UPDATE costos SET fecha=?, tipo=?, cantidad=?, valor=?, notas=? WHERE id=?")
    .run(d.fecha, d.tipo ?? null, d.cantidad ?? null, Math.round(d.valor), d.notas ?? null, id);
}
export function deleteCosto(id: number): void {
  ctx().db.prepare("DELETE FROM costos WHERE id=?").run(id);
}
export function upsertCostoFromAirtable(d: CostoInput & { airtableId: string }): void {
  ctx().db
    .prepare(`
      INSERT INTO costos (airtable_id, fecha, tipo, cantidad, valor, notas)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(airtable_id) DO UPDATE SET
        fecha=excluded.fecha, tipo=excluded.tipo, cantidad=excluded.cantidad,
        valor=excluded.valor, notas=excluded.notas
    `)
    .run(d.airtableId, d.fecha, d.tipo ?? null, d.cantidad ?? null, Math.round(d.valor), d.notas ?? null);
}

// ── Calendario: clases ────────────────────────────────────────────────────

export interface Clase {
  id: number; fecha: string | null; dia: string; profe: string; hora: string | null;
  alumnos: (string | number)[]; nota: string | null; created_at: number;
}
export interface ClaseInput { fecha?: string; dia: string; profe: string; hora?: string; alumnos?: (string | number)[]; nota?: string }

interface ClaseRow {
  id: number; fecha: string | null; dia: string; profe: string; hora: string | null;
  alumnos: string | null; nota: string | null; created_at: number;
}
function parseClase(r: ClaseRow): Clase {
  let alumnos: (string | number)[] = [];
  if (r.alumnos) { try { alumnos = JSON.parse(r.alumnos) as (string | number)[]; } catch { alumnos = []; } }
  return { ...r, alumnos };
}

export function listClases(): Clase[] {
  const rows = ctx().db
    .prepare("SELECT * FROM clases ORDER BY hora IS NULL, hora ASC, id ASC")
    .all() as ClaseRow[];
  return rows.map(parseClase);
}
// Eventos con fecha dentro del rango [desde, hasta] (YYYY-MM-DD, inclusive) — para el calendario mensual.
export function listClasesRange(desde: string, hasta: string): Clase[] {
  const rows = ctx().db
    .prepare("SELECT * FROM clases WHERE fecha BETWEEN ? AND ? ORDER BY fecha ASC, hora IS NULL, hora ASC, id ASC")
    .all(desde, hasta) as ClaseRow[];
  return rows.map(parseClase);
}
export function addClase(d: ClaseInput): number {
  const r = ctx().db
    .prepare("INSERT INTO clases (fecha, dia, profe, hora, alumnos, nota) VALUES (?,?,?,?,?,?)")
    .run(d.fecha ?? null, d.dia, d.profe, d.hora ?? null, JSON.stringify(d.alumnos ?? []), d.nota ?? null);
  return r.lastInsertRowid as number;
}
export function updateClase(id: number, d: ClaseInput): void {
  ctx().db
    .prepare("UPDATE clases SET fecha=?, dia=?, profe=?, hora=?, alumnos=?, nota=? WHERE id=?")
    .run(d.fecha ?? null, d.dia, d.profe, d.hora ?? null, JSON.stringify(d.alumnos ?? []), d.nota ?? null, id);
}
export function deleteClase(id: number): void {
  ctx().db.prepare("DELETE FROM clases WHERE id=?").run(id);
}

export interface ClienteLite { id: number; nombre: string | null; telefono: string; horario: string[] }
export function listClientes(): ClienteLite[] {
  const rows = ctx().db
    .prepare("SELECT id, nombre, telefono, horario FROM clientes ORDER BY nombre ASC")
    .all() as { id: number; nombre: string | null; telefono: string; horario: string | null }[];
  return rows.map((r) => {
    let horario: string[] = [];
    if (r.horario) { try { horario = JSON.parse(r.horario) as string[]; } catch { horario = []; } }
    return { id: r.id, nombre: r.nombre, telefono: r.telefono, horario };
  });
}

// ── Movimientos (asistente de finanzas por Telegram) ──────────────────────

export interface Movimiento {
  id: number; fecha: string; tipo: "gasto" | "ingreso"; monto: number;
  categoria: string | null; descripcion: string | null; origen: string | null;
  chat_id: string | null; created_at: number;
}
export interface MovimientoInput {
  fecha: string; tipo: "gasto" | "ingreso"; monto: number;
  categoria?: string; descripcion?: string; origen?: string; chat_id?: string;
}

export function addMovimiento(d: MovimientoInput): number {
  const r = ctx().db
    .prepare("INSERT INTO movimientos (fecha, tipo, monto, categoria, descripcion, origen, chat_id) VALUES (?,?,?,?,?,?,?)")
    .run(d.fecha, d.tipo, Math.round(d.monto), d.categoria ?? null, d.descripcion ?? null, d.origen ?? null, d.chat_id ?? null);
  return r.lastInsertRowid as number;
}

export function listMovimientos(opts: { mes?: string; categoria?: string } = {}): Movimiento[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.mes) { where.push("substr(fecha,1,7) = ?"); params.push(opts.mes); }
  if (opts.categoria) { where.push("categoria = ?"); params.push(opts.categoria); }
  const sql = "SELECT * FROM movimientos" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY fecha DESC, id DESC";
  return ctx().db.prepare(sql).all(...params) as Movimiento[];
}

export function deleteMovimiento(id: number): void {
  ctx().db.prepare("DELETE FROM movimientos WHERE id = ?").run(id);
}

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

// ── Feedbacks: mensajes con fotos que Mary manda a los apoderados ──────────

export type FeedbackEstado =
  | "borrador" | "ambiguo" | "sin_destinatario" | "enviado" | "cancelado";

export interface Feedback {
  id: number;
  destinatario: string | null;
  cliente_telefono: string | null;
  cliente_nombre: string | null;
  mensaje: string;
  fotos: string[];        // nombres de archivo en data/media
  estado: FeedbackEstado;
  created_at: number;
  sent_at: number | null;
}

interface FeedbackRow extends Omit<Feedback, "fotos"> { fotos: string | null }
function parseFeedback(r: FeedbackRow): Feedback {
  let fotos: string[] = [];
  if (r.fotos) { try { fotos = JSON.parse(r.fotos) as string[]; } catch { fotos = []; } }
  return { ...r, fotos };
}

// Marca como 'cancelado' cualquier borrador pendiente (borrador/ambiguo/sin_destinatario).
// Se llama antes de crear uno nuevo: solo hay UN feedback en preparación a la vez.
export function cancelarBorradoresPendientes(): void {
  ctx().db
    .prepare("UPDATE feedbacks SET estado='cancelado' WHERE estado IN ('borrador','ambiguo','sin_destinatario')")
    .run();
}

// El borrador en preparación más reciente (no enviado ni cancelado). null si no hay.
// Sólo devuelve borradores recientes (≤ 30 min). Uno viejo no debe dispararse por un
// "sí" que en realidad confirmaba otra acción.
export function getBorradorPendiente(): Feedback | null {
  const r = ctx().db
    .prepare(
      "SELECT * FROM feedbacks WHERE estado IN ('borrador','ambiguo','sin_destinatario') AND created_at >= unixepoch() - 1800 ORDER BY id DESC LIMIT 1"
    )
    .get() as FeedbackRow | undefined;
  return r ? parseFeedback(r) : null;
}

export function crearBorradorFeedback(d: {
  destinatario?: string;
  cliente_telefono?: string | null;
  cliente_nombre?: string | null;
  mensaje: string;
  fotos?: string[];
  estado?: FeedbackEstado;
}): number {
  const r = ctx().db
    .prepare(`INSERT INTO feedbacks (destinatario, cliente_telefono, cliente_nombre, mensaje, fotos, estado)
              VALUES (?,?,?,?,?,?)`)
    .run(
      d.destinatario ?? null,
      d.cliente_telefono ?? null,
      d.cliente_nombre ?? null,
      d.mensaje,
      JSON.stringify(d.fotos ?? []),
      d.estado ?? "borrador"
    );
  return r.lastInsertRowid as number;
}

export function marcarFeedbackEnviado(id: number): void {
  ctx().db
    .prepare("UPDATE feedbacks SET estado='enviado', sent_at=unixepoch() WHERE id=?")
    .run(id);
}

// Historial de feedbacks enviados (para la pantalla "lo que va enviando").
export function listFeedbacksEnviados(limit = 100): Feedback[] {
  const rows = ctx().db
    .prepare("SELECT * FROM feedbacks WHERE estado='enviado' ORDER BY sent_at DESC, id DESC LIMIT ?")
    .all(limit) as FeedbackRow[];
  return rows.map(parseFeedback);
}

// ── Web Push: suscripciones de dispositivos ───────────────────────────────

export interface PushSub { endpoint: string; p256dh: string; auth: string }

export function addPushSub(s: PushSub): void {
  ctx()
    .db.prepare(
      "INSERT INTO push_subs (endpoint, p256dh, auth) VALUES (?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth"
    )
    .run(s.endpoint, s.p256dh, s.auth);
}

export function listPushSubs(): PushSub[] {
  return ctx().db.prepare("SELECT endpoint, p256dh, auth FROM push_subs").all() as PushSub[];
}

export function deletePushSub(endpoint: string): void {
  ctx().db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(endpoint);
}
