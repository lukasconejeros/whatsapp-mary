'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppNav from '@/components/AppNav'
import ConversationView from '@/components/ConversationView'
import { Avatar } from '@/components/Avatar'
import { Conversation, CATEGORIA_CONFIG, Categoria } from '@/lib/types'
import { RefreshCw, Search, X, ArrowLeft, MessageCircle, Bell, BellRing, BellOff } from 'lucide-react'
import { activarNotificaciones, estadoNotificaciones, sonarAviso, type EstadoNoti } from '@/lib/push-client'

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

const FILTERS: { key: 'todas' | Categoria; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'mary', label: 'Mary' },
  { key: 'arteluk', label: 'Arteluk' },
  { key: 'potencial', label: 'Meta' },
]

const CATS: Categoria[] = ['mary', 'arteluk', 'potencial']

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todas' | Categoria>('todas')
  const [noti, setNoti] = useState<EstadoNoti>('inactivas')
  const [activando, setActivando] = useState(false)

  useEffect(() => { estadoNotificaciones().then(setNoti) }, [])

  async function onActivarNoti() {
    if (activando) return
    setActivando(true)
    try {
      const r = await activarNotificaciones()
      if (r.ok) { setNoti('activadas') }
      else { alert(r.error || 'No se pudo activar'); setNoti(await estadoNotificaciones()) }
    } catch {
      alert('No se pudo activar. Reintenta.')
    } finally {
      setActivando(false) // nunca dejar el botón trabado en "Activando…"
    }
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const d = await fetch('/api/conversations').then(r => r.json())
      if (d.ok) setConversations(d.conversations)
    } finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Real-time: recarga la lista cuando llega un mensaje nuevo. NO cerramos en onerror:
  // así EventSource reconecta solo tras un corte de red (antes se apagaba para siempre
  // al primer error y la lista dejaba de actualizarse hasta recargar la página).
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('update', (e: MessageEvent) => {
      load(true)
      // Aviso in-app: sólo Arteluk/Meta y sólo si la app NO está enfocada (para no
      // sonar por lo que Mary misma está viendo/enviando).
      try {
        const d = JSON.parse(e.data) as { categoria?: string; nombre?: string; preview?: string; role?: string }
        // Solo si el último mensaje es ENTRANTE (role 'user'); nunca por lo que Mary/el bot/n8n envían.
        if (d.role === 'user' && (d.categoria === 'arteluk' || d.categoria === 'potencial') && typeof document !== 'undefined' && !document.hasFocus()) {
          sonarAviso()
          if ('Notification' in window && Notification.permission === 'granted') {
            const titulo = d.categoria === 'potencial' ? `Nuevo lead: ${d.nombre || ''}`.trim() : (d.nombre || 'Arteluk')
            new Notification(titulo, { body: d.preview || 'Mensaje nuevo', icon: '/icon.svg' })
          }
        }
      } catch { /* payload viejo, ignorar */ }
    })
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

  async function cambiarCategoria(id: number, categoria: Categoria) {
    setConversations(p => p.map(c => c.id === id ? { ...c, categoria } : c))
    try {
      await fetch(`/api/categoria/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria }),
      })
    } catch { /* la UI ya se actualizó de forma optimista */ }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#FFFFFF' }}>
      <div className="flex items-center gap-2" style={{ color: '#C0879F' }}>
        <RefreshCw size={13} className="spin" />
        <span style={{ fontSize: 13 }}>Cargando...</span>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0"
          style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #FAD1E5' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#9D174D' }}>Chats</span>
          <span style={{ fontSize: 12, color: '#C0879F' }}>{conversations.length}</span>
          <div className="flex-1" />
          <button onClick={noti === 'activadas' ? undefined : onActivarNoti} disabled={activando || noti === 'activadas'}
            title="Avisos cuando escribe un cliente de Arteluk o un lead de Meta" className="flex items-center gap-1.5"
            style={{ height: 30, padding: '0 10px', borderRadius: 8,
              border: '1px solid ' + (noti === 'activadas' ? '#BBF7D0' : '#FAD1E5'),
              background: noti === 'activadas' ? '#DCFCE7' : '#FFFFFF', fontSize: 12,
              color: noti === 'activadas' ? '#15803D' : noti === 'bloqueadas' ? '#C2410C' : '#EC4899',
              cursor: noti === 'activadas' ? 'default' : 'pointer', fontFamily: 'inherit', opacity: activando ? 0.5 : 1 }}>
            {noti === 'activadas' ? <BellRing size={12} /> : noti === 'bloqueadas' ? <BellOff size={12} /> : <Bell size={12} />}
            {noti === 'activadas' ? 'Avisos ✓' : noti === 'bloqueadas' ? 'Bloqueados' : activando ? 'Activando…' : 'Activar avisos'}
          </button>
          <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5"
            style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid #FAD1E5', background: '#FFFFFF', fontSize: 12, color: '#EC4899', cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
            Actualizar
          </button>
        </header>

        <div className={`chat-shell ${selected ? 'has-selection' : ''}`}>
          {/* ── Lista de chats ── */}
          <div className="chat-list-pane">
            <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #FDE7F1' }}>
              <div className="relative flex items-center" style={{ marginBottom: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, color: '#C0879F', pointerEvents: 'none' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar chat o mensaje..."
                  style={{ width: '100%', paddingLeft: 31, paddingRight: search ? 30 : 12, height: 34, fontSize: 13, borderRadius: 10, border: '1px solid #FAD1E5', background: '#FFF4FA', color: '#9D174D', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#EC4899'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#FAD1E5'; e.target.style.background = '#FFF4FA' }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, cursor: 'pointer', color: '#C0879F', background: 'none', border: 'none', display: 'flex' }}><X size={12} /></button>}
              </div>
              <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                {FILTERS.map(f => {
                  const on = filter === f.key
                  return (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                        border: on ? '1px solid #EC4899' : '1px solid #FAD1E5',
                        background: on ? '#EC4899' : '#fff', color: on ? '#fff' : '#B0708C' }}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p style={{ fontSize: 12, color: '#DBAFC6', textAlign: 'center', padding: '30px 16px' }}>
                  {conversations.length === 0 ? 'Aún no hay conversaciones. Conecta WhatsApp para empezar a recibirlas.' : 'Nada por aquí con ese filtro.'}
                </p>
              ) : filtered.map(conv => {
                const cat = (conv.categoria ?? 'mary') as Categoria
                const active = selectedId === conv.id
                return (
                  <button key={conv.id} onClick={() => setSelectedId(conv.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #FBEAF2', cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? '#FDE7F1' : 'transparent' }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#FFF4FA' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar src={conv.contact.avatar} size={46} />
                      <span title={CATEGORIA_CONFIG[cat].label} style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: CATEGORIA_CONFIG[cat].dot, border: '2px solid #fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#6E2547', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.contact.name}</span>
                        <span style={{ fontSize: 11, color: '#CE8AAE', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(conv.lastMessage?.createdAt || conv.updatedAt)}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: '#B0708C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
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
                  style={{ gap: 8, height: 42, padding: '0 12px', border: 'none', borderBottom: '1px solid #FDE7F1', background: '#fff', color: '#BE185D', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  <ArrowLeft size={17} /> Chats
                </button>
                {/* Mover la conversación de grupo (funciona en teléfono y PC) */}
                <div className="flex items-center" style={{ gap: 6, padding: '6px 12px', borderBottom: '1px solid #FDE7F1', background: '#fff', flexShrink: 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#B0708C', marginRight: 2 }}>Grupo:</span>
                  {CATS.map(cat => {
                    const on = (selected.categoria ?? 'mary') === cat
                    return (
                      <button key={cat} onClick={() => cambiarCategoria(selected.id, cat)}
                        style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                          border: on ? '1px solid #EC4899' : '1px solid #FAD1E5', background: on ? '#EC4899' : '#fff', color: on ? '#fff' : '#B0708C' }}>
                        {CATEGORIA_CONFIG[cat].label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <ConversationView key={selected.id} conv={selected} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: 10, color: '#DBAFC6', padding: 24, textAlign: 'center' }}>
                <MessageCircle size={40} strokeWidth={1.4} style={{ color: '#F7CFE1' }} />
                <p style={{ fontSize: 13 }}>Elige una conversación para verla</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
