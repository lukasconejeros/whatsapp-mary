'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppNav from '@/components/AppNav'
import ConversationView from '@/components/ConversationView'
import { Avatar } from '@/components/Avatar'
import { Conversation, CATEGORIA_CONFIG, Categoria } from '@/lib/types'
import { RefreshCw, Search, X, ArrowLeft, MessageCircle } from 'lucide-react'
import { sonarAviso } from '@/lib/push-client'

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

// Pestañas del inbox. Meta = leads de Meta sin cerrar; Seguimiento = leads cerrados
// (los que Mary movió con el botón "Cerrado", listos para la campaña de seguimiento).
type Tab = 'todos' | 'arteluk' | 'meta' | 'seguimiento'
const FILTERS: { key: Tab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'arteluk', label: 'Arteluk' },
  { key: 'meta', label: 'Meta' },
  { key: 'seguimiento', label: 'Seguimiento' },
]

// Chips para RECLASIFICAR una conversación de categoría (dentro del chat).
const CATS: Categoria[] = ['mary', 'arteluk', 'potencial']
const CAT_SHORT: Record<Categoria, string> = { mary: 'Mary', arteluk: 'Arteluk', potencial: 'Meta' }

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Tab>('todos')
  const [segStats, setSegStats] = useState<{ pendientes: number; enviados: number; omitidos: number; enviadosHoy: number } | null>(null)
  const [segCand, setSegCand] = useState(0)
  const [segBusy, setSegBusy] = useState(false)
  const [segMsg, setSegMsg] = useState('')
  const [msgDirty, setMsgDirty] = useState(false)
  const [savingMsg, setSavingMsg] = useState(false)
  const msgLoadedRef = useRef(false)

  // Progreso de la campaña + plantilla editable. La plantilla se carga UNA vez (no la
  // pisamos en cada refresco para no borrar lo que Mary está escribiendo).
  const cargarSeguimiento = useCallback(async () => {
    try {
      const d = await fetch('/api/seguimiento').then(r => r.json())
      if (d.ok) {
        setSegStats(d.stats); setSegCand(d.candidatos)
        if (!msgLoadedRef.current && typeof d.mensaje === 'string') { setSegMsg(d.mensaje); msgLoadedRef.current = true }
      }
    } catch { /* sin conexión: no romper la vista */ }
  }, [])

  async function guardarMensaje() {
    if (savingMsg || !segMsg.trim()) return
    setSavingMsg(true)
    try {
      const d = await fetch('/api/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', mensaje: segMsg }) }).then(r => r.json())
      if (d.ok) setMsgDirty(false)
      else alert(d.error || 'No se pudo guardar el mensaje')
    } catch { alert('No se pudo guardar. Revisa tu internet.') }
    finally { setSavingMsg(false) }
  }

  async function iniciarSeguimiento() {
    if (segBusy) return
    if (msgDirty && !confirm('Tienes cambios sin guardar en el mensaje. ¿Enviar igual con el mensaje guardado anterior?')) return
    if (!confirm(`¿Enviar el seguimiento a ${segCand} lead(s) en Seguimiento?\n\nSe mandan de a poco, con pausas y tope diario, para no arriesgar el número.`)) return
    setSegBusy(true)
    try {
      const d = await fetch('/api/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'iniciar' }) }).then(r => r.json())
      if (d.ok) { setSegStats(d.stats); await cargarSeguimiento(); alert(`Listo: ${d.agregados} en cola. Se irán enviando solos, de a poco.`) }
      else alert(d.error || 'No se pudo iniciar')
    } catch { alert('No se pudo iniciar. Revisa tu internet.') }
    finally { setSegBusy(false) }
  }

  async function detenerSeguimiento() {
    if (segBusy) return
    if (!confirm('¿Detener la campaña? Los que faltan por enviar se cancelan (los ya enviados quedan).')) return
    setSegBusy(true)
    try {
      const d = await fetch('/api/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'detener' }) }).then(r => r.json())
      if (d.ok) { setSegStats(d.stats); await cargarSeguimiento() }
    } catch { /* la próxima recarga refleja el estado real */ }
    finally { setSegBusy(false) }
  }

  // Envía UN seguimiento de prueba a este contacto (para verificar con tu propio número).
  async function probarSeguimiento(id: number) {
    if (segBusy) return
    if (!confirm('¿Enviar UN seguimiento de prueba a este contacto?\n\nÚsalo con tu propio número para verificar que llega bien antes del envío masivo.')) return
    setSegBusy(true)
    try {
      const d = await fetch('/api/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', conversationId: id }) }).then(r => r.json())
      if (d.ok) { alert('En cola. El bot lo enviará en menos de un minuto.'); cargarSeguimiento() }
      else alert(d.error || 'No se pudo enviar la prueba')
    } catch { alert('No se pudo. Revisa tu internet.') }
    finally { setSegBusy(false) }
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
  // así EventSource reconecta solo tras un corte de red.
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('update', (e: MessageEvent) => {
      load(true)
      try {
        const d = JSON.parse(e.data) as { categoria?: string; nombre?: string; preview?: string; role?: string }
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

  // En la pestaña Seguimiento, carga el progreso y lo refresca cada 6 s.
  useEffect(() => {
    if (filter !== 'seguimiento') return
    cargarSeguimiento()
    const t = setInterval(cargarSeguimiento, 6000)
    return () => clearInterval(t)
  }, [filter, cargarSeguimiento])

  const filtered = useMemo(() => {
    let list = conversations.filter(c => {
      const cat = (c.categoria ?? 'mary') as Categoria
      const cerrado = !!c.cerrado
      if (filter === 'todos') return true
      if (filter === 'arteluk') return cat === 'arteluk'
      if (filter === 'meta') return cat === 'potencial' && !cerrado
      if (filter === 'seguimiento') return cat === 'potencial' && cerrado
      return true
    })
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

  // "Cerrado": mueve el lead a Seguimiento (y lleva la vista ahí). "Reabrir": lo devuelve
  // a Meta. Es el flujo pedido: Meta → Cerrado → Seguimiento.
  async function marcarCerrado(id: number, cerrado: boolean) {
    setConversations(p => p.map(c => c.id === id ? { ...c, cerrado } : c))
    setFilter(cerrado ? 'seguimiento' : 'meta')
    try {
      await fetch(`/api/cerrado/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cerrado }),
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

  const enviando = !!(segStats && segStats.pendientes > 0)

  return (
    <div className={`flex h-screen overflow-hidden ${selected ? 'chat-open' : ''}`} style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0"
          style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #FAD1E5' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#9D174D' }}>Chats</span>
          <span style={{ fontSize: 12, color: '#C0879F' }}>{conversations.length}</span>
          <div className="flex-1" />
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
                  style={{ width: '100%', paddingLeft: 31, paddingRight: search ? 30 : 12, height: 38, fontSize: 14, borderRadius: 10, border: '1px solid #FAD1E5', background: '#FFF4FA', color: '#9D174D', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#EC4899'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#FAD1E5'; e.target.style.background = '#FFF4FA' }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, cursor: 'pointer', color: '#C0879F', background: 'none', border: 'none', display: 'flex' }}><X size={13} /></button>}
              </div>
              <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                {FILTERS.map(f => {
                  const on = filter === f.key
                  return (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                        border: on ? '1px solid #EC4899' : '1px solid #FAD1E5',
                        background: on ? '#EC4899' : '#fff', color: on ? '#fff' : '#B0708C' }}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Panel de Seguimiento: mensaje EDITABLE + enviar/detener + progreso. */}
            {filter === 'seguimiento' && (
              <div style={{ padding: '12px', borderBottom: '1px solid #FDE7F1', background: '#FFF9FC' }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: '#9D174D', marginBottom: 6 }}>Mensaje de seguimiento</p>
                <textarea value={segMsg} onChange={e => { setSegMsg(e.target.value); setMsgDirty(true) }}
                  rows={5} placeholder="Escribe el mensaje que se enviará…"
                  style={{ width: '100%', resize: 'vertical', borderRadius: 10, border: '1px solid #FAD1E5', background: '#fff', padding: '10px 12px', fontSize: 14, lineHeight: 1.5, color: '#0F172A', outline: 'none', fontFamily: 'inherit' }} />
                <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: '#B0708C', flex: 1 }}>Usa <b>{'{nombre}'}</b> y <b>{'{alumno}'}</b> para personalizar.</span>
                  <button onClick={guardarMensaje} disabled={savingMsg || !msgDirty}
                    style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: (savingMsg || !msgDirty) ? 'default' : 'pointer', fontFamily: 'inherit', border: '1px solid #FAD1E5', background: msgDirty ? '#fff' : '#F9F0F5', color: msgDirty ? '#BE185D' : '#C0879F' }}>
                    {savingMsg ? 'Guardando…' : msgDirty ? 'Guardar' : 'Guardado ✓'}
                  </button>
                </div>

                <div className="flex items-center" style={{ gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, color: '#B0708C' }}>
                      {enviando ? `Enviando… ${segStats!.enviados} enviados · ${segStats!.pendientes} en cola` : `${segCand} lead(s) en seguimiento`}
                    </p>
                  </div>
                  {enviando ? (
                    <button onClick={detenerSeguimiento} disabled={segBusy}
                      style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: segBusy ? 'default' : 'pointer', fontFamily: 'inherit', border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', flexShrink: 0, opacity: segBusy ? 0.5 : 1 }}>
                      Detener
                    </button>
                  ) : (
                    <button onClick={iniciarSeguimiento} disabled={segBusy || segCand === 0}
                      style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: (segBusy || segCand === 0) ? 'default' : 'pointer', fontFamily: 'inherit', border: 'none', background: (segBusy || segCand === 0) ? '#F7CFE1' : '#EC4899', color: '#fff', flexShrink: 0 }}>
                      {segBusy ? 'Enviando…' : 'Enviar seguimiento'}
                    </button>
                  )}
                </div>
                {enviando && (
                  <div style={{ height: 5, borderRadius: 999, background: '#FDE7F1', overflow: 'hidden', marginTop: 8 }}>
                    <div style={{ height: '100%', borderRadius: 999, background: '#EC4899', width: `${Math.round((segStats!.enviados / Math.max(1, segStats!.enviados + segStats!.pendientes)) * 100)}%`, transition: 'width 0.4s' }} />
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p style={{ fontSize: 13, color: '#DBAFC6', textAlign: 'center', padding: '30px 16px' }}>
                  {conversations.length === 0 ? 'Aún no hay conversaciones. Conecta WhatsApp para empezar a recibirlas.'
                    : filter === 'seguimiento' ? 'Sin leads en seguimiento. Marca un lead de Meta como "Cerrado" para que aparezca aquí.'
                    : 'Nada por aquí con ese filtro.'}
                </p>
              ) : filtered.map(conv => {
                const active = selectedId === conv.id
                return (
                  <button key={conv.id} onClick={() => setSelectedId(conv.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #FBEAF2', cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? '#FDE7F1' : 'transparent' }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#FFF4FA' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div style={{ flexShrink: 0 }}>
                      <Avatar src={conv.contact.avatar} size={46} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#6E2547', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.contact.name}</span>
                        <span style={{ fontSize: 11.5, color: '#CE8AAE', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(conv.lastMessage?.createdAt || conv.updatedAt)}</span>
                      </div>
                      <p style={{ fontSize: 13.5, color: '#B0708C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {conv.lastMessage?.fromHuman && conv.lastMessage?.content ? <span style={{ color: '#C68BAA' }}>Tú: </span> : null}
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
                  style={{ gap: 8, height: 44, padding: '0 12px', border: 'none', borderBottom: '1px solid #FDE7F1', background: '#fff', color: '#BE185D', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  <ArrowLeft size={18} /> Chats
                </button>
                {/* Reclasificar de categoría + (Meta: Cerrar) / (Seguimiento: Reabrir + Probar) */}
                <div className="flex items-center" style={{ gap: 4, padding: '5px 10px', borderBottom: '1px solid #FDE7F1', background: '#fff', flexShrink: 0 }}>
                  {CATS.map(cat => {
                    const on = (selected.categoria ?? 'mary') === cat
                    return (
                      <button key={cat} onClick={() => cambiarCategoria(selected.id, cat)} title={CATEGORIA_CONFIG[cat].label}
                        style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                          border: on ? '1px solid #EC4899' : '1px solid #FAD1E5', background: on ? '#EC4899' : '#fff', color: on ? '#fff' : '#B0708C' }}>
                        {CAT_SHORT[cat]}
                      </button>
                    )
                  })}
                  {(selected.categoria ?? 'mary') === 'potencial' && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {selected.cerrado ? (
                        <>
                          <button onClick={() => probarSeguimiento(selected.id)} disabled={segBusy} title="Enviar UN seguimiento de prueba a este contacto (úsalo con tu número)"
                            style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: segBusy ? 'default' : 'pointer', fontFamily: 'inherit', border: '1px solid #FAD1E5', background: '#fff', color: '#B0708C', opacity: segBusy ? 0.5 : 1 }}>
                            Probar
                          </button>
                          <button onClick={() => marcarCerrado(selected.id, false)} title="Devolver este lead a Meta"
                            style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #FAD1E5', background: '#fff', color: '#B0708C' }}>
                            Reabrir
                          </button>
                        </>
                      ) : (
                        <button onClick={() => marcarCerrado(selected.id, true)} title="Cerrar y pasar a Seguimiento"
                          style={{ fontSize: 12.5, fontWeight: 700, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: '#EC4899', color: '#fff' }}>
                          Cerrado
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <ConversationView key={selected.id} conv={selected} />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: 10, color: '#DBAFC6', padding: 24, textAlign: 'center' }}>
                <MessageCircle size={40} strokeWidth={1.4} style={{ color: '#F7CFE1' }} />
                <p style={{ fontSize: 14 }}>Elige una conversación para verla</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
