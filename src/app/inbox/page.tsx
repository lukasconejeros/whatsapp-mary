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

// Pestañas del inbox. Meta = leads sin cerrar (envío de promo). Seguimiento = leads que
// pagaron la prueba (botón del chat los mueve aquí) = envío de seguimiento.
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
  const [segStats, setSegStats] = useState<{ pendientes: number; enviados: number } | null>(null)
  const [candMeta, setCandMeta] = useState(0)
  const [candSeg, setCandSeg] = useState(0)
  const [segBusy, setSegBusy] = useState(false)
  const [msgMeta, setMsgMeta] = useState('')
  const [msgSeg, setMsgSeg] = useState('')
  const [dirtyMeta, setDirtyMeta] = useState(false)
  const [dirtySeg, setDirtySeg] = useState(false)
  const [savingMsg, setSavingMsg] = useState(false)
  const [editando, setEditando] = useState(false)
  const msgLoadedRef = useRef(false)

  // Al cambiar de pestaña, el mensaje vuelve a estar plegado.
  useEffect(() => { setEditando(false) }, [filter])

  // Progreso + candidatos de ambos envíos + las dos plantillas (se cargan una vez).
  const cargarSeguimiento = useCallback(async () => {
    try {
      const d = await fetch('/api/seguimiento').then(r => r.json())
      if (d.ok) {
        setSegStats(d.stats); setCandMeta(d.candMeta); setCandSeg(d.candSeguimiento)
        if (!msgLoadedRef.current) {
          if (typeof d.msgMeta === 'string') setMsgMeta(d.msgMeta)
          if (typeof d.msgSeguimiento === 'string') setMsgSeg(d.msgSeguimiento)
          msgLoadedRef.current = true
        }
      }
    } catch { /* sin conexión: no romper la vista */ }
  }, [])

  async function guardarMensaje(tipo: 'meta' | 'seguimiento', mensaje: string, limpiarDirty: () => void) {
    if (savingMsg || !mensaje.trim()) return
    setSavingMsg(true)
    try {
      const d = await fetch('/api/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', tipo, mensaje }) }).then(r => r.json())
      if (d.ok) limpiarDirty()
      else alert(d.error || 'No se pudo guardar el mensaje')
    } catch { alert('No se pudo guardar. Revisa tu internet.') }
    finally { setSavingMsg(false) }
  }

  async function iniciar(tipo: 'meta' | 'seguimiento', cand: number, dirty: boolean) {
    if (segBusy) return
    if (dirty && !confirm('Tienes cambios sin guardar en el mensaje. Guarda primero para enviar el texto nuevo. ¿Enviar igual con el guardado?')) return
    const quien = tipo === 'meta' ? 'leads de Meta' : 'chats en Seguimiento'
    if (!confirm(`¿Enviar el mensaje a ${cand} ${quien}?\n\nSe mandan de a poco, con pausas y tope diario, para no arriesgar el número.`)) return
    setSegBusy(true)
    try {
      const d = await fetch('/api/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'iniciar', tipo }) }).then(r => r.json())
      if (d.ok) { setSegStats(d.stats); await cargarSeguimiento(); alert(`Listo: ${d.agregados} en cola. Se irán enviando solos, de a poco.`) }
      else alert(d.error || 'No se pudo iniciar')
    } catch { alert('No se pudo iniciar. Revisa tu internet.') }
    finally { setSegBusy(false) }
  }

  async function detener() {
    if (segBusy) return
    if (!confirm('¿Detener los envíos? Los que faltan por mandar se cancelan (los ya enviados quedan).')) return
    setSegBusy(true)
    try {
      const d = await fetch('/api/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'detener' }) }).then(r => r.json())
      if (d.ok) { setSegStats(d.stats); await cargarSeguimiento() }
    } catch { /* la próxima recarga refleja el estado real */ }
    finally { setSegBusy(false) }
  }

  async function probar(id: number) {
    if (segBusy) return
    if (!confirm('¿Enviar UN mensaje de prueba a este contacto?\n\nÚsalo con tu propio número para ver cómo llega antes del envío masivo.')) return
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

  // Respaldo al SSE: refresca la lista sola cada 10 s mientras la app está visible (en el
  // iPhone-PWA el SSE a veces se corta; así los chats se actualizan solos sin tocar «Actualizar»).
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') load(true)
    }, 10000)
    return () => clearInterval(t)
  }, [load])

  // En Meta o Seguimiento, carga el progreso y lo refresca cada 6 s.
  useEffect(() => {
    if (filter !== 'meta' && filter !== 'seguimiento') return
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
      await fetch(`/api/categoria/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoria }) })
    } catch { /* la UI ya se actualizó de forma optimista */ }
  }

  // Botón del chat: mueve el lead a Seguimiento (pagó la prueba) o lo devuelve a Meta.
  async function marcarCerrado(id: number, cerrado: boolean) {
    setConversations(p => p.map(c => c.id === id ? { ...c, cerrado } : c))
    setFilter(cerrado ? 'seguimiento' : 'meta')
    try {
      await fetch(`/api/cerrado/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cerrado }) })
    } catch { /* la UI ya se actualizó de forma optimista */ }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#FFFFFF' }}>
      <div className="flex items-center gap-2" style={{ color: '#8696A0' }}>
        <RefreshCw size={13} className="spin" />
        <span style={{ fontSize: 13 }}>Cargando...</span>
      </div>
    </div>
  )

  const enviando = !!(segStats && segStats.pendientes > 0)
  const pct = segStats ? Math.round((segStats.enviados / Math.max(1, segStats.enviados + segStats.pendientes)) * 100) : 0

  // Panel de envío editable, reutilizado en Meta y en Seguimiento.
  const panelEnvio = (tipo: 'meta' | 'seguimiento') => {
    const esMeta = tipo === 'meta'
    const msg = esMeta ? msgMeta : msgSeg
    const setMsg = esMeta ? setMsgMeta : setMsgSeg
    const dirty = esMeta ? dirtyMeta : dirtySeg
    const setDirty = esMeta ? setDirtyMeta : setDirtySeg
    const cand = esMeta ? candMeta : candSeg
    const titulo = esMeta ? 'Mensaje para los leads de Meta' : 'Mensaje de seguimiento (pagaron la prueba)'
    const cta = esMeta ? 'Enviar a Meta' : 'Enviar seguimiento'
    return (
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #D3E7DE', background: '#F3F9F6' }}>
        {/* Cabecera compacta: título + botón Editar (despliega el cuadro de texto) */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#054D44', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</p>
          <button onClick={() => setEditando(v => !v)}
            style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #D3E7DE', background: '#fff', color: '#008069', flexShrink: 0 }}>
            {editando ? 'Cerrar' : 'Editar'}
          </button>
        </div>
        {editando ? (
          <>
            <textarea value={msg} onChange={e => { setMsg(e.target.value); setDirty(true) }} rows={5}
              placeholder="Escribe el mensaje que se enviará…"
              style={{ width: '100%', resize: 'vertical', borderRadius: 10, border: '1px solid #D3E7DE', background: '#fff', padding: '10px 12px', fontSize: 14, lineHeight: 1.5, color: '#111B21', outline: 'none', fontFamily: 'inherit', marginTop: 8 }} />
            <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: '#667781', flex: 1 }}>Se envía tal cual a los leads (mensaje general, sin nombres).</span>
              <button onClick={() => guardarMensaje(tipo, msg, () => setDirty(false))} disabled={savingMsg || !dirty}
                style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: (savingMsg || !dirty) ? 'default' : 'pointer', fontFamily: 'inherit', border: '1px solid #D3E7DE', background: dirty ? '#fff' : '#EAF4EF', color: dirty ? '#008069' : '#8696A0' }}>
                {savingMsg ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado ✓'}
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 12, color: '#667781', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg || 'Sin mensaje. Toca Editar.'}</p>
        )}
        <div className="flex items-center" style={{ gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12.5, color: '#667781', flex: 1 }}>
            {enviando ? `Enviando… ${segStats!.enviados} enviados · ${segStats!.pendientes} en cola` : `${cand} chat(s)`}
          </span>
          {enviando ? (
            <button onClick={detener} disabled={segBusy}
              style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 8, cursor: segBusy ? 'default' : 'pointer', fontFamily: 'inherit', border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', flexShrink: 0, opacity: segBusy ? 0.5 : 1 }}>
              Detener
            </button>
          ) : (
            <button onClick={() => iniciar(tipo, cand, dirty)} disabled={segBusy || cand === 0}
              style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: (segBusy || cand === 0) ? 'default' : 'pointer', fontFamily: 'inherit', border: 'none', background: (segBusy || cand === 0) ? '#A7D8CC' : '#00A884', color: '#fff', flexShrink: 0 }}>
              {segBusy ? 'Enviando…' : cta}
            </button>
          )}
        </div>
        {enviando && (
          <div style={{ height: 5, borderRadius: 999, background: '#D3E7DE', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', borderRadius: 999, background: '#00A884', width: `${pct}%`, transition: 'width 0.4s' }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex h-screen overflow-hidden ${selected ? 'chat-open' : ''}`} style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0"
          style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #D3E7DE' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#054D44' }}>Chats</span>
          <span style={{ fontSize: 12, color: '#8696A0' }}>{conversations.length}</span>
          <div className="flex-1" />
          <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-1.5"
            style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid #D3E7DE', background: '#FFFFFF', fontSize: 12, color: '#00A884', cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={11} className={refreshing ? 'spin' : ''} />
            Actualizar
          </button>
        </header>

        <div className={`chat-shell ${selected ? 'has-selection' : ''}`}>
          {/* ── Lista de chats ── */}
          <div className="chat-list-pane">
            <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #E7F1EC' }}>
              <div className="relative flex items-center" style={{ marginBottom: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, color: '#8696A0', pointerEvents: 'none' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar chat o mensaje..."
                  style={{ width: '100%', paddingLeft: 31, paddingRight: search ? 30 : 12, height: 38, fontSize: 14, borderRadius: 10, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#054D44', outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = '#00A884'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#D3E7DE'; e.target.style.background = '#F3F9F6' }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, cursor: 'pointer', color: '#8696A0', background: 'none', border: 'none', display: 'flex' }}><X size={13} /></button>}
              </div>
              <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
                {FILTERS.map(f => {
                  const on = filter === f.key
                  return (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                        border: on ? '1px solid #00A884' : '1px solid #D3E7DE',
                        background: on ? '#00A884' : '#fff', color: on ? '#fff' : '#667781' }}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {filter === 'meta' && panelEnvio('meta')}
            {filter === 'seguimiento' && panelEnvio('seguimiento')}

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9AA7AD', textAlign: 'center', padding: '30px 16px' }}>
                  {conversations.length === 0 ? 'Aún no hay conversaciones. Conecta WhatsApp para empezar a recibirlas.'
                    : filter === 'seguimiento' ? 'Sin chats en seguimiento. En un chat de Meta toca "Pagó la prueba" para moverlo aquí.'
                    : 'Nada por aquí con ese filtro.'}
                </p>
              ) : filtered.map(conv => {
                const active = selectedId === conv.id
                return (
                  <button key={conv.id} onClick={() => setSelectedId(conv.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #EEF5F1', cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? '#E7F1EC' : 'transparent' }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#F3F9F6' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <div style={{ flexShrink: 0 }}>
                      <Avatar src={conv.contact.avatar} size={46} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: '#111B21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.contact.name}</span>
                        <span style={{ fontSize: 11.5, color: '#8696A0', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(conv.lastMessage?.createdAt || conv.updatedAt)}</span>
                      </div>
                      <p style={{ fontSize: 13.5, color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {(conv.categoria === 'potencial') && conv.contactado && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#008069', background: '#D9FDD3', borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>✓ Enviado</span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.lastMessage?.fromHuman && conv.lastMessage?.content ? <span style={{ color: '#8696A0' }}>Tú: </span> : null}
                          {conv.lastMessage?.content || '—'}
                        </span>
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
                  style={{ gap: 8, height: 44, padding: '0 12px', border: 'none', borderBottom: '1px solid #E7F1EC', background: '#fff', color: '#008069', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  <ArrowLeft size={18} /> Chats
                </button>
                <div className="flex items-center" style={{ gap: 4, padding: '5px 10px', borderBottom: '1px solid #E7F1EC', background: '#fff', flexShrink: 0 }}>
                  {CATS.map(cat => {
                    const on = (selected.categoria ?? 'mary') === cat
                    return (
                      <button key={cat} onClick={() => cambiarCategoria(selected.id, cat)} title={CATEGORIA_CONFIG[cat].label}
                        style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                          border: on ? '1px solid #00A884' : '1px solid #D3E7DE', background: on ? '#00A884' : '#fff', color: on ? '#fff' : '#667781' }}>
                        {CAT_SHORT[cat]}
                      </button>
                    )
                  })}
                  {(selected.categoria ?? 'mary') === 'potencial' && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button onClick={() => probar(selected.id)} disabled={segBusy} title="Enviar UN mensaje de prueba a este contacto (úsalo con tu número)"
                        style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: segBusy ? 'default' : 'pointer', fontFamily: 'inherit', border: '1px solid #D3E7DE', background: '#fff', color: '#667781', opacity: segBusy ? 0.5 : 1 }}>
                        Probar
                      </button>
                      {selected.cerrado ? (
                        <button onClick={() => marcarCerrado(selected.id, false)} title="Devolver este lead a Meta"
                          style={{ fontSize: 12.5, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #D3E7DE', background: '#fff', color: '#667781' }}>
                          Volver a Meta
                        </button>
                      ) : (
                        <button onClick={() => marcarCerrado(selected.id, true)} title="Pagó la clase de prueba → pasar a Seguimiento"
                          style={{ fontSize: 12.5, fontWeight: 700, padding: '5px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: '#00A884', color: '#fff' }}>
                          Pagó la prueba
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
              <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: 10, color: '#9AA7AD', padding: 24, textAlign: 'center' }}>
                <MessageCircle size={40} strokeWidth={1.4} style={{ color: '#B8E0C8' }} />
                <p style={{ fontSize: 14 }}>Elige una conversación para verla</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
