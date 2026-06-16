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
  sent INTEGER NOT NULL DEFAULT 0,
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

function build(): Ctx {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  // micro-migración: añadir columnas que no existan
  const cols = db.prepare("PRAGMA table_info(conversations)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "jid")) {
    db.exec("ALTER TABLE conversations ADD COLUMN jid TEXT");
  }
  if (!cols.some((c) => c.name === "estado")) {
    db.exec("ALTER TABLE conversations ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo'");
  }
  if (!cols.some((c) => c.name === "categoria")) {
    db.exec("ALTER TABLE conversations ADD COLUMN categoria TEXT NOT NULL DEFAULT 'mary'");
  }
  if (!cols.some((c) => c.name === "categoria_manual")) {
    db.exec("ALTER TABLE conversations ADD COLUMN categoria_manual INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.some((c) => c.name === "ctwa_referral")) {
    db.exec("ALTER TABLE conversations ADD COLUMN ctwa_referral TEXT");
  }
  // micro-migración clientes: columnas nuevas (email/estado/horario/alumnos)
  const cliCols = db.prepare("PRAGMA table_info(clientes)").all() as { name: string }[];
  for (const col of ["email", "estado", "horario", "alumnos"]) {
    if (!cliCols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE clientes ADD COLUMN ${col} TEXT`);
    }
  }

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
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
    ),
    updateLastMsg: db.prepare(
      "UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?"
    ),
    getMsgs: db.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
    ),
    getConnState: db.prepare("SELECT * FROM connection_state WHERE id = 1"),
    upsertConnState: db.prepare(
      "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1"
    ),
    enqueueOutboxStmt: db.prepare(
      "INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)"
    ),
    getPendingOutboxStmt: db.prepare(
      "SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT ?"
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

  // 2. No existe por phone. Si el nombre es dedupable, buscar una conversación
  //    existente del MISMO contacto que llegó antes con otro identificador
  //    (LID vs número real). Esto evita el duplicado sin mapeo de Baileys.
  if (nameIsDedupable(name)) {
    const byName = c.db
      .prepare("SELECT * FROM conversations WHERE name = ? ORDER BY id ASC LIMIT 1")
      .get(name.trim()) as Conversation | undefined;
    if (byName) {
      const newJid = preferRealJid(byName.jid, jid);
      if (newJid && newJid !== byName.jid) c.updateConvJid.run(newJid, byName.id);
      return c.getConvById.get(byName.id) as Conversation;
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
  content: string
): number {
  const c = ctx();
  const insert = c.db.transaction(() => {
    const result = c.insertMsg.run(conversationId, role, content);
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
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
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
  content: string
): number {
  const result = ctx().enqueueOutboxStmt.run(conversationId, phone, content);
  return result.lastInsertRowid as number;
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return ctx().getPendingOutboxStmt.all(limit) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  ctx().markSentStmt.run(id);
}

export function deleteConversation(conversationId: number): void {
  const c = ctx();
  const del = c.db.transaction(() => {
    c.deleteMsgs.run(conversationId);
    c.deleteOutbox.run(conversationId);
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

export function getClienteByPhone(phone: string): Cliente | null {
  const tel = normalizeChilePhone(phone);
  if (!tel) return null;
  return (
    (ctx().db.prepare("SELECT * FROM clientes WHERE telefono = ?").get(tel) as
      | Cliente
      | undefined) ?? null
  );
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
