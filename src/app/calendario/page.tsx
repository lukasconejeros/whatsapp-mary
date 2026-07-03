'use client'

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import { DIA_LABEL, PROFES, PROFE_NOMBRES, profeColor, diaFromFecha } from '@/lib/calendario'
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react'

type Clase = { id: number; fecha: string | null; dia: string; profe: string; hora: string | null; alumnos: (string | number)[]; nota: string | null }
type ClienteLite = { id: number; nombre: string | null; telefono: string; horario: string[] }
type Form = { fecha: string; profe: string; hora: string; alumnos: number[]; alumnosExtra: (string | number)[]; nota: string }

const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Fecha local → 'YYYY-MM-DD' (sin pasar por UTC, evita corrimientos de día).
function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function capital(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }
function fechaLarga(f: string): string {
  const d = new Date(`${f}T12:00:00`)
  return capital(d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }))
}

export default function CalendarioPage() {
  const hoy = ymd(new Date())
  const [cursor, setCursor] = useState(() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() } })
  const [sel, setSel] = useState<string>(hoy)
  const [clases, setClases] = useState<Clase[]>([])
  const [clientes, setClientes] = useState<ClienteLite[]>([])
  const [filtro, setFiltro] = useState<string>('Todas')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Form>({ fecha: hoy, profe: 'Mary', hora: '16:00', alumnos: [], alumnosExtra: [], nota: '' })
  const [search, setSearch] = useState('')

  // Celdas de la grilla del mes (semanas completas, lunes→domingo).
  const first = new Date(cursor.y, cursor.m, 1)
  const offset = (first.getDay() + 6) % 7 // 0 = lunes
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7
  const cells: Date[] = Array.from({ length: totalCells }, (_, i) => new Date(cursor.y, cursor.m, 1 - offset + i))
  const desde = ymd(cells[0])
  const hasta = ymd(cells[cells.length - 1])

  const load = useCallback(async (d: string, h: string) => {
    setLoading(true)
    try {
      const [c, cl] = await Promise.all([
        fetch(`/api/clases?desde=${d}&hasta=${h}`).then(r => r.json()),
        fetch('/api/clientes').then(r => r.json()),
      ])
      if (c.ok) setClases(c.clases)
      if (cl.ok) setClientes(cl.clientes)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(desde, hasta) }, [load, desde, hasta])

  function goMonth(delta: number) {
    const nd = new Date(cursor.y, cursor.m + delta, 1)
    const y = nd.getFullYear(), m = nd.getMonth()
    const t = new Date()
    setSel(ymd(y === t.getFullYear() && m === t.getMonth() ? t : nd))
    setCursor({ y, m })
  }
  function irHoy() {
    const t = new Date()
    setCursor({ y: t.getFullYear(), m: t.getMonth() })
    setSel(ymd(t))
  }

  function openNew(fecha: string) {
    setEditId(null); setSearch('')
    setForm({ fecha, profe: 'Mary', hora: '16:00', alumnos: [], alumnosExtra: [], nota: '' })
    setShowForm(true)
  }
  function openEdit(c: Clase) {
    setEditId(c.id); setSearch('')
    const nums = c.alumnos.filter((a): a is number => typeof a === 'number')
    const extra = c.alumnos.filter((a) => typeof a !== 'number')
    setForm({ fecha: c.fecha ?? sel, profe: c.profe, hora: c.hora ?? '', alumnos: nums, alumnosExtra: extra, nota: c.nota ?? '' })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null) }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    const url = editId ? `/api/clases/${editId}` : '/api/clases'
    const body = {
      fecha: form.fecha,
      dia: diaFromFecha(form.fecha),
      profe: form.profe,
      hora: form.hora || undefined,
      alumnos: [...form.alumnos, ...form.alumnosExtra],
      nota: form.nota.trim() || undefined,
    }
    const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if ((await r.json()).ok) { closeForm(); load(desde, hasta) }
  }
  async function del(c: Clase) {
    if ((await fetch(`/api/clases/${c.id}`, { method: 'DELETE' }).then(x => x.json())).ok) load(desde, hasta)
  }

  const nombreCliente = (id: number) => clientes.find(c => c.id === id)?.nombre || `#${id}`
  const etiquetaAlumno = (a: string | number) => typeof a === 'number' ? nombreCliente(a) : a
  const pasaFiltro = (c: Clase) => filtro === 'Todas' || c.profe === filtro
  const eventosDe = (fecha: string) => clases.filter(c => c.fecha === fecha && pasaFiltro(c))
  const eventosSel = eventosDe(sel)

  // Selector de alumnos del modal: primero los que vienen ese día, con búsqueda.
  const diaForm = diaFromFecha(form.fecha)
  const clientesOrdenados = [...clientes]
    .filter(c => !search.trim() || (c.nombre ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ad = a.horario.includes(diaForm) ? 0 : 1
      const bd = b.horario.includes(diaForm) ? 0 : 1
      return ad - bd || (a.nombre ?? '').localeCompare(b.nombre ?? '')
    })
  function toggleAlumno(id: number) {
    setForm(f => ({ ...f, alumnos: f.alumnos.includes(id) ? f.alumnos.filter(x => x !== id) : [...f.alumnos, id] }))
  }

  const monthName = capital(new Date(cursor.y, cursor.m, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFF4FA' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0" style={{ minHeight: 48, padding: '6px 20px', background: '#FFFFFF', borderBottom: '1px solid #FAD1E5', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9D174D' }}>Calendario</span>
          <div className="flex items-center gap-1">
            <button onClick={() => goMonth(-1)} title="Mes anterior" style={{ display: 'flex', border: '1px solid #FAD1E5', background: '#fff', borderRadius: 8, padding: 5, cursor: 'pointer', color: '#BE185D' }}><ChevronLeft size={15} /></button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#9D174D', minWidth: 130, textAlign: 'center' }}>{monthName}</span>
            <button onClick={() => goMonth(1)} title="Mes siguiente" style={{ display: 'flex', border: '1px solid #FAD1E5', background: '#fff', borderRadius: 8, padding: 5, cursor: 'pointer', color: '#BE185D' }}><ChevronRight size={15} /></button>
            <button onClick={irHoy} style={{ marginLeft: 4, border: '1px solid #FAD1E5', background: '#fff', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', color: '#B0708C', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>Hoy</button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap' }}>
            {['Todas', ...PROFE_NOMBRES].map(p => {
              const active = filtro === p
              const col = p === 'Todas' ? '#9D174D' : profeColor(p).color
              return (
                <button key={p} onClick={() => setFiltro(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? col : '#FAD1E5'}`, background: active ? col : '#fff', color: active ? '#fff' : '#B0708C' }}>
                  {p !== 'Todas' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : profeColor(p).color, display: 'inline-block' }} />}
                  {p}
                </button>
              )
            })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="cal-main">
            {/* Grilla del mes */}
            <section className="cal-grid">
              <div style={{ background: '#fff', border: '1px solid #FAD1E5', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(190,24,93,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #FDE7F1' }}>
                  {DOW_LABELS.map(d => (
                    <div key={d} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#B0708C' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {cells.map((cell, i) => {
                    const f = ymd(cell)
                    const inMonth = cell.getMonth() === cursor.m
                    const isHoy = f === hoy
                    const isSel = f === sel
                    const evs = eventosDe(f)
                    return (
                      <button key={i} onClick={() => setSel(f)}
                        style={{ position: 'relative', minHeight: 92, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 3,
                          padding: '5px 5px 6px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                          border: 'none', borderRight: (i % 7 !== 6) ? '1px solid #FDE7F1' : 'none', borderBottom: (i < cells.length - 7) ? '1px solid #FDE7F1' : 'none',
                          background: isSel ? '#FDE7F1' : inMonth ? '#fff' : '#FFF9FC',
                          boxShadow: isSel ? 'inset 0 0 0 2px #EC4899' : 'none' }}>
                        <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, borderRadius: 999, padding: '0 4px',
                          fontSize: 11, fontWeight: isHoy ? 800 : 600,
                          background: isHoy ? '#EC4899' : 'transparent', color: isHoy ? '#fff' : inMonth ? '#374151' : '#DBAFC6' }}>{cell.getDate()}</span>
                        {evs.slice(0, 3).map(c => {
                          const pc = profeColor(c.profe)
                          const label = c.nota || (c.alumnos.length ? c.alumnos.map(etiquetaAlumno).join(', ') : c.profe)
                          return (
                            <span key={c.id} title={`${c.hora ?? ''} ${c.profe} ${label}`.trim()}
                              style={{ display: 'block', fontSize: 10, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                background: pc.bg, color: '#3f2a35', borderLeft: `3px solid ${pc.color}`, borderRadius: 5, padding: '2px 5px' }}>
                              {c.hora ? <b style={{ color: pc.color }}>{c.hora}</b> : null} {label}
                            </span>
                          )
                        })}
                        {evs.length > 3 && <span style={{ fontSize: 10, color: '#B0708C', paddingLeft: 3 }}>+{evs.length - 3} más</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Detalle del día seleccionado */}
            <aside className="cal-detail">
              <div style={{ background: '#fff', border: '1px solid #FAD1E5', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(190,24,93,0.06)' }}>
                <div className="flex items-center gap-2" style={{ padding: '12px 14px', borderBottom: '1px solid #FDE7F1' }}>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#9D174D' }}>{fechaLarga(sel)}</p>
                  <button onClick={() => openNew(sel)} title="Agregar clase"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: '#EC4899', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>
                    <Plus size={14} /> Agregar
                  </button>
                </div>
                <div style={{ padding: 12, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                  {loading ? <p style={{ fontSize: 12, color: '#DBAFC6', textAlign: 'center', padding: '24px 0' }}>Cargando…</p>
                    : eventosSel.length === 0 ? <p style={{ fontSize: 12, color: '#C0879F', textAlign: 'center', padding: '24px 0' }}>Sin clases este día.<br />Toca «Agregar» para crear una.</p>
                    : eventosSel.map(c => {
                      const pc = profeColor(c.profe)
                      return (
                        <div key={c.id} style={{ background: pc.bg, border: `1px solid ${pc.bd}`, borderLeft: `3px solid ${pc.color}`, borderRadius: 10, padding: '9px 11px', marginBottom: 8 }}>
                          <div className="flex items-center gap-2" style={{ marginBottom: 5 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#1F2937' }}>{c.hora || '—'}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, flex: 1 }}>{c.profe}</span>
                            <button onClick={() => openEdit(c)} title="Editar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B0708C' }}><Pencil size={13} /></button>
                            <button onClick={() => del(c)} title="Borrar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B0708C' }}><Trash2 size={13} /></button>
                          </div>
                          {c.nota && <p style={{ fontSize: 12, color: '#5A1A38', fontWeight: 600, marginBottom: 5 }}>{c.nota}</p>}
                          <div className="flex flex-wrap gap-1">
                            {c.alumnos.length === 0 ? <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sin alumnos</span>
                              : c.alumnos.map((a, k) => (
                                <span key={k} style={{ fontSize: 11, color: '#374151', background: '#fff', border: '1px solid ' + pc.bd, borderRadius: 6, padding: '1px 6px' }}>{etiquetaAlumno(a)}</span>
                              ))}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Modal agregar / editar */}
      {showForm && (
        <div onClick={closeForm} style={{ position: 'fixed', inset: 0, background: 'rgba(131,24,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitForm}
            style={{ background: '#fff', borderRadius: 16, padding: 20, width: 420, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(131,24,67,0.25)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#9D174D' }}>{editId ? 'Editar' : 'Agregar'} clase · {fechaLarga(form.fecha)}</p>
              <button type="button" onClick={closeForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#C0879F', display: 'flex' }}><X size={16} /></button>
            </div>

            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#B0708C' }}>Profe</label>
                <select value={form.profe} onChange={e => setForm({ ...form, profe: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #FAD1E5', fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
                  {PROFES.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ width: 110 }}>
                <label style={{ fontSize: 12, color: '#B0708C' }}>Hora</label>
                <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #FAD1E5', fontFamily: 'inherit', fontSize: 13 }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#B0708C' }}>Título / nota</label>
              <input value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} placeholder="Ej: taller de óleo"
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #FAD1E5', fontFamily: 'inherit', fontSize: 13 }} />
            </div>

            <label style={{ fontSize: 12, color: '#B0708C' }}>Alumnos ({form.alumnos.length + form.alumnosExtra.length})</label>
            {form.alumnosExtra.length > 0 && (
              <div className="flex flex-wrap gap-1" style={{ margin: '4px 0' }}>
                {form.alumnosExtra.map((a, k) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#374151', background: '#FDE7F1', border: '1px solid #FAD1E5', borderRadius: 6, padding: '1px 6px' }}>
                    {String(a)}
                    <button type="button" onClick={() => setForm(f => ({ ...f, alumnosExtra: f.alumnosExtra.filter((_, j) => j !== k) }))}
                      style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B0708C', padding: 0 }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar alumno…"
              style={{ width: '100%', margin: '4px 0 8px', padding: '8px 10px', borderRadius: 8, border: '1px solid #FAD1E5', fontFamily: 'inherit', fontSize: 13 }} />
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #FDE7F1', borderRadius: 8 }}>
              {clientesOrdenados.map(c => {
                const selA = form.alumnos.includes(c.id)
                const esDelDia = c.horario.includes(diaForm)
                return (
                  <button type="button" key={c.id} onClick={() => toggleAlumno(c.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: 'none', borderBottom: '1px solid #FFF4FA', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', background: selA ? '#FDE7F1' : '#fff' }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: '1px solid ' + (selA ? '#EC4899' : '#FAD1E5'), background: selA ? '#EC4899' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>{selA ? '✓' : ''}</span>
                    <span style={{ flex: 1, color: '#374151' }}>{c.nombre || c.telefono}</span>
                    {esDelDia && <span style={{ fontSize: 10, fontWeight: 700, color: '#EC4899', background: '#FDE7F1', borderRadius: 5, padding: '1px 6px' }}>viene {DIA_LABEL[diaForm] ?? diaForm}</span>}
                  </button>
                )
              })}
              {clientesOrdenados.length === 0 && <p style={{ fontSize: 12, color: '#DBAFC6', textAlign: 'center', padding: '14px 0' }}>Sin clientes</p>}
            </div>

            <button type="submit" style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 9, border: 'none', background: '#EC4899', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
          </form>
        </div>
      )}
    </div>
  )
}
