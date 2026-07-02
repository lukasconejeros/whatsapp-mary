'use client'

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import PatientCard from '@/components/PatientCard'
import ConversationView from '@/components/ConversationView'
import { Conversation, CATEGORIA_ORDER, CATEGORIA_CONFIG } from '@/lib/types'
import { RefreshCw, Search, X } from 'lucide-react'

const COL_DOT: Record<string, string> = {
  mary: '#9CA3AF', arteluk: '#22C55E', potencial: '#B76E79',
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

  function handleCategoriaChange(id: number, categoria: Conversation['categoria']) {
    setConversations(p => p.map(c => c.id !== id ? c : { ...c, categoria }))
  }

  const filtered = search.trim()
    ? conversations.filter(c => c.contact.name.toLowerCase().includes(search.toLowerCase()) || c.contact.phone.includes(search))
    : conversations

  const selected = conversations.find(c => c.id === selectedId) ?? null
  const grouped = CATEGORIA_ORDER.reduce((a, cat) => ({ ...a, [cat]: filtered.filter(c => (c.categoria ?? 'mary') === cat) }), {} as Record<string, Conversation[]>)

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
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4A2E39' }}>Embudo</span>
          <span style={{ fontSize: 12, color: '#9A8188' }}>{conversations.length} conversaciones</span>
          <div className="flex-1" />
          <div className="relative flex items-center">
            <Search size={12} style={{ position: 'absolute', left: 9, color: '#9A8188', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              style={{ paddingLeft: 28, paddingRight: search ? 28 : 10, height: 30, fontSize: 12, borderRadius: 8,
                border: '1px solid #EBDCE3', background: '#FBF7F9', color: '#4A2E39', outline: 'none', width: 180, fontFamily: 'inherit' }}
              onFocus={e => { e.target.style.borderColor = '#B76E79'; e.target.style.background = '#fff' }}
              onBlur={e => { e.target.style.borderColor = '#EBDCE3'; e.target.style.background = '#FBF7F9' }} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, cursor: 'pointer', color: '#9A8188', background: 'none', border: 'none', display: 'flex' }}><X size={11} /></button>}
          </div>
          <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5"
            style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid #EBDCE3', background: '#FFFFFF',
              fontSize: 12, color: '#B76E79', cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
            Actualizar
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 h-full" style={{ padding: '16px 20px', minWidth: selected ? 'auto' : 'max-content' }}>
              {CATEGORIA_ORDER.map(cat => {
                const cfg = CATEGORIA_CONFIG[cat]
                const list = grouped[cat] || []
                return (
                  <div key={cat} className="flex flex-col shrink-0 overflow-hidden"
                    style={{ width: selected ? 'clamp(160px, 15vw, 210px)' : 264, borderRadius: 12, background: '#FFFFFF', border: '1px solid #EBDCE3', boxShadow: '0 1px 3px rgba(190,24,93,0.06)' }}>
                    <div className="flex items-center gap-2 shrink-0" style={{ padding: '10px 14px', borderBottom: '1px solid #F3E7EC' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: COL_DOT[cat], display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#4A2E39', flex: 1 }}>{cfg.label}</span>
                      <span style={{ fontSize: 11, color: '#9A8188' }}>{list.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {list.length === 0
                        ? <p style={{ fontSize: 12, color: '#DFC9D2', textAlign: 'center', padding: '28px 0' }}>Sin registros</p>
                        : list.map(conv => (
                          <PatientCard key={conv.id} conv={conv}
                            selected={selectedId === conv.id}
                            onSelect={() => setSelectedId(p => p === conv.id ? null : conv.id)}
                            onCategoriaChange={handleCategoriaChange} />
                        ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {selected && (
            <div className="slide-in flex flex-col shrink-0"
              style={{ width: 440, borderLeft: '1px solid #EBDCE3', background: '#fff', overflow: 'hidden' }}>
              <div className="flex items-center justify-between shrink-0"
                style={{ padding: '0 16px', height: 38, borderBottom: '1px solid #F3E7EC' }}>
                <span style={{ fontSize: 11, color: '#9A8188' }}>#{selected.id}</span>
                <button onClick={() => setSelectedId(null)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9A8188' }}>
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
