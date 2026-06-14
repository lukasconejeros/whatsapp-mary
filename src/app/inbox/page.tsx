'use client'

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import PatientCard from '@/components/PatientCard'
import ConversationView from '@/components/ConversationView'
import { Conversation, COLUMN_ORDER, STATE_CONFIG } from '@/lib/types'
import { RefreshCw, Search, X } from 'lucide-react'

const COL_DOT: Record<string, string> = {
  activo: '#2563EB', resuelto: '#F59E0B', agendado: '#16A34A', derivado: '#8B5CF6', cancelado: '#94A3B8',
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const d = await fetch('/api/conversations').then(r => r.json())
      if (d.ok) setConversations(d.conversations)
    } finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time via SSE — recarga automático cuando llega mensaje nuevo
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('update', () => load(true))
    es.onerror = () => es.close()
    return () => es.close()
  }, [load])

  function handleBotToggle(id: number, labels: string[], botActive: boolean) {
    setConversations(p => p.map(c => c.id !== id ? c : { ...c, labels, botActive, state: (botActive ? 'activo' : 'derivado') as Conversation['state'] }))
  }

  const filtered = search.trim()
    ? conversations.filter(c => c.contact.name.toLowerCase().includes(search.toLowerCase()) || c.contact.phone.includes(search))
    : conversations

  const selected = conversations.find(c => c.id === selectedId) ?? null
  const grouped = COLUMN_ORDER.reduce((a, s) => ({ ...a, [s]: filtered.filter(c => c.state === s) }), {} as Record<string, Conversation[]>)

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#EFF6FF' }}>
      <div className="flex items-center gap-2" style={{ color: '#93C5FD' }}>
        <RefreshCw size={13} className="spin" />
        <span style={{ fontSize: 13 }}>Cargando...</span>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#EFF6FF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0"
          style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #BFDBFE' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>Embudo</span>
          <span style={{ fontSize: 12, color: '#93C5FD' }}>{conversations.length} conversaciones</span>
          <div className="flex-1" />
          <div className="relative flex items-center">
            <Search size={12} style={{ position: 'absolute', left: 9, color: '#93C5FD', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              style={{ paddingLeft: 28, paddingRight: search ? 28 : 10, height: 30, fontSize: 12, borderRadius: 6,
                border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1E3A5F', outline: 'none', width: 180, fontFamily: 'inherit' }}
              onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.background = '#fff' }}
              onBlur={e => { e.target.style.borderColor = '#BFDBFE'; e.target.style.background = '#EFF6FF' }} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, cursor: 'pointer', color: '#93C5FD', background: 'none', border: 'none', display: 'flex' }}><X size={11} /></button>}
          </div>
          <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5"
            style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#FFFFFF',
              fontSize: 12, color: '#2563EB', cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
            Actualizar
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 h-full" style={{ padding: '16px 20px', minWidth: selected ? 'auto' : 'max-content' }}>
              {COLUMN_ORDER.map(state => {
                const cfg = STATE_CONFIG[state]
                const list = grouped[state] || []
                return (
                  <div key={state} className="flex flex-col shrink-0 overflow-hidden"
                    style={{ width: selected ? 'clamp(160px, 15vw, 210px)' : 264, borderRadius: 8, background: '#FFFFFF', border: '1px solid #BFDBFE', boxShadow: '0 1px 2px rgba(30,58,95,0.06)' }}>
                    <div className="flex items-center gap-2 shrink-0" style={{ padding: '10px 14px', borderBottom: '1px solid #DBEAFE' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: COL_DOT[state], display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1E3A5F', flex: 1 }}>{cfg.label}</span>
                      <span style={{ fontSize: 11, color: '#93C5FD' }}>{list.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {list.length === 0
                        ? <p style={{ fontSize: 12, color: '#BFDBFE', textAlign: 'center', padding: '28px 0' }}>Sin registros</p>
                        : list.map(conv => (
                          <PatientCard key={conv.id} conv={conv}
                            selected={selectedId === conv.id}
                            onSelect={() => setSelectedId(p => p === conv.id ? null : conv.id)}
                            onBotToggle={handleBotToggle} />
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {selected && (
            <div className="slide-in flex flex-col shrink-0"
              style={{ width: 440, borderLeft: '1px solid #BFDBFE', background: '#fff', overflow: 'hidden' }}>
              <div className="flex items-center justify-between shrink-0"
                style={{ padding: '0 16px', height: 38, borderBottom: '1px solid #DBEAFE' }}>
                <span style={{ fontSize: 11, color: '#93C5FD' }}>#{selected.id}</span>
                <button onClick={() => setSelectedId(null)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#93C5FD' }}>
                  <X size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ConversationView key={selected.id} conv={selected} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
