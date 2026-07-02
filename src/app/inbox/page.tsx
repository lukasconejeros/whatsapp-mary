'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppNav from '@/components/AppNav'
import ConversationView from '@/components/ConversationView'
import { Conversation, CATEGORIA_CONFIG, Categoria } from '@/lib/types'
import { RefreshCw, Search, X, ArrowLeft, MessageCircle } from 'lucide-react'

function timeAgo(ts: string | number): string {
  if (!ts) return ''
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'ahora'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 172800) return 'ayer'
  return `${Math.floor(s / 86400)}d`
}

const HUE = ['#B76E79', '#8B5CF6', '#C98A97', '#10B981', '#F59E0B', '#6366F1']
function avatarBg(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % HUE.length; return HUE[Math.abs(h)] }
function ini(n: string) { return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?' }

const FILTERS: { key: 'todas' | Categoria; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'mary', label: 'Mary' },
  { key: 'arteluk', label: 'Arteluk' },
  { key: 'potencial', label: 'Potenciales' },
]

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todas' | Categoria>('todas')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const d = await fetch('/api/conversations').then(r => r.json())
      if (d.ok) setConversations(d.conversations)
    } finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Real-time: recarga la lista cuando llega un mensaje nuevo
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('update', () => load(true))
    es.onerror = () => es.close()
    return () => es.close()
  }, [load])

  const filtered = useMemo(() => {
    let list = conversations
    if (filter !== 'todas') list = list.filter(c => (c.categoria ?? 'mary') === filter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(c =>
      c.contact.name.toLowerCase().includes(q) ||
      c.contact.phone.includes(q) ||
      (c.lastMessage?.content ?? '').toLowerCase().includes(q))
    return list
  }, [conversations, filter, search])

  const selected = conversations.find(c => c.id === selectedId) ?? null

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#FBF7F9' }}>
      <div className="flex items-center gap-2" style={{ color: '#9A8188' }}>
        <RefreshCw size={13} className="spin" />
        <span style={{ fontSize: 13 }}>Cargando...</span>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FBF7F9' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0"
          style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #EBDCE3' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#4A2E39' }}>Chats</span>
          <span style={{ fontSize: 12, color: '#9A8188' }}>{conversations.length}</span>
          <div className="flex-1" />
          <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5"
            style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid #EBDCE3', background: '#FFFFFF', fontSize: 12, color: '#B76E79', cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
            Actualizar
          </button>
        </header>

        <div className={`chat-shell ${selected ? 'has-selection' : ''}`}>
          {/* ── Lista de chats ── */}
          <div className="chat-list-pane">
            <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #F3E7EC' }}>
              <div className="relative flex items-center" style={{ marginBottom: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, color: '#9A8188', pointerEvents: 'none' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar chat o mensaje..."
                  style={{ width: '100%', paddingLeft: 31, paddingRight: search ? 30 : 12, height: 34, fontSize: 13, borderRadius: 10, border: '1px solid #EBDCE3', background: '#FBF7F9', color: '#4A2E39', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#B76E79'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#EBDCE3'; e.target.style.background = '#FBF7F9' }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, cursor: 'pointer', color: '#9A8188', background: 'none', border: 'none', display: 'flex' }}><X size={12} /></button>}
              </div>
              <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                {FILTERS.map(f => {
                  const on = filter === f.key
                  return (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                        border: on ? '1px solid #B76E79' : '1px solid #EBDCE3',
                        background: on ? '#B76E79' : '#fff', color: on ? '#fff' : '#8A7079' }}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p style={{ fontSize: 12, color: '#C0A6B0', textAlign: 'center', padding: '30px 16px' }}>
                  {conversations.length === 0 ? 'Aún no hay conversaciones. Conecta WhatsApp para empezar a recibirlas.' : 'Nada por aquí con ese filtro.'}
                </p>
              ) : filtered.map(conv => {
                const cat = (conv.categoria ?? 'mary') as Categoria
                const active = selectedId === conv.id
                return (
                  <button key={conv.id} onClick={() => setSelectedId(conv.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #F7EEF2', cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? '#F3E7EC' : 'transparent' }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#FBF7F9' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: avatarBg(conv.contact.name), color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {ini(conv.contact.name)}
                      </div>
                      <span title={CATEGORIA_CONFIG[cat].label} style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: CATEGORIA_CONFIG[cat].dot, border: '2px solid #fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#3D2A32', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.contact.name}</span>
                        <span style={{ fontSize: 11, color: '#B08097', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(conv.lastMessage?.createdAt || conv.updatedAt)}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#8A7079', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {conv.lastMessage?.content || '—'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Panel de conversación ── */}
          <div className="chat-detail-pane">
            {selected ? (
              <>
                <button className="chat-back items-center" onClick={() => setSelectedId(null)}
                  style={{ gap: 8, height: 42, padding: '0 12px', border: 'none', borderBottom: '1px solid #F3E7EC', background: '#fff', color: '#8E5563', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  <ArrowLeft size={17} /> Chats
                </button>
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <ConversationView key={selected.id} conv={selected} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: 10, color: '#C0A6B0', padding: 24, textAlign: 'center' }}>
                <MessageCircle size={40} strokeWidth={1.4} style={{ color: '#DFC9D2' }} />
                <p style={{ fontSize: 13 }}>Elige una conversación para verla</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
