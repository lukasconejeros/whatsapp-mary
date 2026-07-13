export type ConvState = 'activo' | 'derivado' | 'agendado' | 'cancelado' | 'resuelto'
export type Channel = 'whatsapp' | 'instagram' | 'messenger' | 'tiktok' | 'unknown'

export const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; bg: string; dot: string }> = {
  whatsapp:  { label: 'WhatsApp',  color: '#15803D', bg: '#DCFCE7', dot: '#22C55E' },
  instagram: { label: 'Instagram', color: '#7E22CE', bg: '#F3E8FF', dot: '#A855F7' },
  messenger: { label: 'Messenger', color: '#008069', bg: '#E7F1EC', dot: '#00A884' },
  tiktok:    { label: 'TikTok',    color: '#111827', bg: '#F1F5F9', dot: '#374151' },
  unknown:   { label: 'Otro',      color: '#374151', bg: '#F3F4F6', dot: '#6B7280' },
}

export interface Contact { name: string; phone: string; avatar?: string }
export interface Conversation {
  id: number
  state: ConvState
  labels: string[]
  status: string
  channel: Channel
  contact: Contact
  assignee: { name: string } | null
  lastMessage: { content: string; createdAt: number | string; fromHuman: boolean }
  createdAt: number | string
  updatedAt: number | string
  inboxId: number
  botActive: boolean
  categoria: Categoria
  cerrado: boolean
  ctwaReferral: { title?: string; body?: string; sourceId?: string; sourceUrl?: string } | null
}

export interface Message {
  id: number
  content: string
  messageType: number
  senderName: string
  senderType: string
  createdAt: number
  isPrivate: boolean
  media?: string | null
}

export const STATE_CONFIG: Record<ConvState, { label: string; color: string; bg: string; accent: string; dot: string }> = {
  activo:   { label: 'En conversación',   color: '#008069', bg: '#F3F9F6', accent: '#00A884', dot: '#00A884' },
  resuelto: { label: 'Quieren agendar',   color: '#B45309', bg: '#FFFBEB', accent: '#F59E0B', dot: '#F59E0B' },
  agendado: { label: 'Agendaron',         color: '#15803D', bg: '#F0FDF4', accent: '#22C55E', dot: '#22C55E' },
  derivado: { label: 'Derivado a humano', color: '#6D28D9', bg: '#F5F3FF', accent: '#8B5CF6', dot: '#8B5CF6' },
  cancelado:{ label: 'Cancelaron',        color: '#9CA3AF', bg: '#F9FAFB', accent: '#9CA3AF', dot: '#9CA3AF' },
}

// Orden tipo funnel: conversando → interesado → agendó → (derivado/cancelado)
export const COLUMN_ORDER: ConvState[] = ['activo', 'resuelto', 'agendado', 'derivado', 'cancelado']

// ── Categorías del embudo de la app de Mary (Arteluk) ──────────────────────
export type Categoria = 'mary' | 'arteluk' | 'potencial'

// Orden de columnas tal como lo pidió la usuaria.
export const CATEGORIA_ORDER: Categoria[] = ['mary', 'arteluk', 'potencial']

export const CATEGORIA_CONFIG: Record<Categoria, { label: string; color: string; bg: string; dot: string }> = {
  mary:      { label: 'Conversaciones Mary',    color: '#6B7280', bg: '#F9FAFB', dot: '#9CA3AF' },
  arteluk:   { label: 'Conversaciones Arteluk', color: '#15803D', bg: '#F0FDF4', dot: '#22C55E' },
  potencial: { label: 'Meta',   color: '#008069', bg: '#E7F1EC', dot: '#00A884' },
}

export type LeadEstado = 'nuevo' | 'calificado' | 'demo' | 'cliente' | 'descartado'

export const LEAD_COLUMN_ORDER: LeadEstado[] = ['nuevo', 'calificado', 'demo', 'cliente', 'descartado']

export const LEAD_STATE_CONFIG: Record<LeadEstado, { label: string; color: string; bg: string; accent: string }> = {
  nuevo:      { label: 'Nuevos',      color: '#008069', bg: '#F3F9F6', accent: '#00A884' },
  calificado: { label: 'Calificados', color: '#6D28D9', bg: '#F5F3FF', accent: '#8B5CF6' },
  demo:       { label: 'Demo',        color: '#15803D', bg: '#F0FDF4', accent: '#22C55E' },
  cliente:    { label: 'Clientes',    color: '#B45309', bg: '#FFFBEB', accent: '#F59E0B' },
  descartado: { label: 'Descartados', color: '#374151', bg: '#F9FAFB', accent: '#9CA3AF' },
}

export interface Lead {
  id: number
  conversation_id: number | null
  phone: string
  nombre: string | null
  negocio: string | null
  facturacion: string | null
  dolor: string | null
  estado: LeadEstado
  created_at: number
  mode: 'AI' | 'HUMAN' | null
  last_message: string | null
  last_message_at: number | null
}
