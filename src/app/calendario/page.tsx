'use client'

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import { DIAS, DIA_LABEL, PROFES, PROFE_NOMBRES, profeColor } from '@/lib/calendario'
import { Plus, Trash2, Pencil, X } from 'lucide-react'

type Clase = { id: number; dia: string; profe: string; hora: string | null; alumnos: number[]; nota: string | null }
type ClienteLite = { id: number; nombre: string | null; telefono: string; horario: string[] }

export default function CalendarioPage() {
  const [clases, setClases] = useState<Clase[]>([])
  const [clientes, setClientes] = useState<ClienteLite[]>([])
  const [filtro, setFiltro] = useState<string>('Todas')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<{ dia: string; profe: string; hora: string; alumnos: number[] }>({ dia: 'Lunes', profe: 'Mary', hora: '16:00', alumnos: [] })
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, cl] = await Promise.all([
        fetch('/api/clases').then(r => r.json()),
        fetch('/api/clientes').then(r => r.json()),
      ])
      if (c.ok) setClases(c.clases)
      if (cl.ok) setClientes(cl.clientes)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  function openNew(dia: string) {
    setEditId(null); setSearch('')
    setForm({ dia, profe: 'Mary', hora: '16:00', alumnos: [] })
    setShowForm(true)
  }
  function openEdit(c: Clase) {
    setEditId(c.id); setSearch('')
    setForm({ dia: c.dia, profe: c.profe, hora: c.hora ?? '', alumnos: c.alumnos })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null) }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    const url = editId ? `/api/clases/${editId}` : '/api/clases'
    const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if ((await r.json()).ok) { closeForm(); load() }
  }
  async function del(c: Clase) {
    if ((await fetch(`/api/clases/${c.id}`, { method: 'DELETE' }).then(x => x.json())).ok) load()
  }

  const nombreCliente = (id: number) => clientes.find(c => c.id === id)?.nombre || `#${id}`
  const visibles = (dia: string) => clases.filter(c => c.dia === dia && (filtro === 'Todas' || c.profe === filtro))

  // selector: primero los del día elegido, luego el resto; con búsqueda
  const clientesOrdenados = [...clientes]
    .filter(c => !search.trim() || (c.nombre ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ad = a.horario.includes(form.dia) ? 0 : 1
      const bd = b.horario.includes(form.dia) ? 0 : 1
      return ad - bd || (a.nombre ?? '').localeCompare(b.nombre ?? '')
    })

  function toggleAlumno(id: number) {
    setForm(f => ({ ...f, alumnos: f.alumnos.includes(id) ? f.alumnos.filter(x => x !== id) : [...f.alumnos, id] }))
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FDF2F8' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0" style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #FBCFE8' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#831843' }}>Calendario</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            {['Todas', ...PROFE_NOMBRES].map(p => {
              const active = filtro === p
              const col = p === 'Todas' ? '#831843' : profeColor(p).color
              return (
                <button key={p} onClick={() => setFiltro(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? col : '#FBCFE8'}`, background: active ? col : '#fff', color: active ? '#fff' : '#9D5577' }}>
                  {p !== 'Todas' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : profeColor(p).color, display: 'inline-block' }} />}
                  {p}
                </button>
              )
            })}
          </div>
        </header>

        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full" style={{ padding: '16px 20px', minWidth: 'max-content' }}>
            {DIAS.map(dia => (
              <div key={dia} className="flex flex-col shrink-0 overflow-hidden"
                style={{ width: 230, borderRadius: 12, background: '#FFFFFF', border: '1px solid #FBCFE8', boxShadow: '0 1px 3px rgba(190,24,93,0.06)' }}>
                <div className="flex items-center gap-2 shrink-0" style={{ padding: '10px 14px', borderBottom: '1px solid #FCE7F3' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#831843', flex: 1 }}>{DIA_LABEL[dia]}</span>
                  <button onClick={() => openNew(dia)} title="Agregar clase"
                    style={{ display: 'flex', border: 'none', background: '#FCE7F3', borderRadius: 7, padding: 4, cursor: 'pointer', color: '#DB2777' }}><Plus size={14} /></button>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
                  {loading ? <p style={{ fontSize: 12, color: '#C99BB4', textAlign: 'center', padding: '20px 0' }}>…</p>
                    : visibles(dia).length === 0 ? <p style={{ fontSize: 12, color: '#E7BBD0', textAlign: 'center', padding: '20px 0' }}>Sin clases</p>
                    : visibles(dia).map(c => {
                      const pc = profeColor(c.profe)
                      return (
                        <div key={c.id} style={{ background: pc.bg, border: `1px solid ${pc.bd}`, borderLeft: `3px solid ${pc.color}`, borderRadius: 10, padding: '8px 10px', marginBottom: 8 }}>
                          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#1F2937' }}>{c.hora || '—'}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, flex: 1 }}>{c.profe}</span>
                            <button onClick={() => openEdit(c)} title="Editar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9D5577' }}><Pencil size={13} /></button>
                            <button onClick={() => del(c)} title="Borrar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9D5577' }}><Trash2 size={13} /></button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {c.alumnos.length === 0 ? <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sin alumnos</span>
                              : c.alumnos.map(id => (
                                <span key={id} style={{ fontSize: 11, color: '#374151', background: '#fff', border: '1px solid ' + pc.bd, borderRadius: 6, padding: '1px 6px' }}>{nombreCliente(id)}</span>
                              ))}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div onClick={closeForm} style={{ position: 'fixed', inset: 0, background: 'rgba(131,24,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitForm}
            style={{ background: '#fff', borderRadius: 16, padding: 20, width: 420, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(131,24,67,0.25)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#831843' }}>{editId ? 'Editar' : 'Agregar'} clase · {DIA_LABEL[form.dia]}</p>
              <button type="button" onClick={closeForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#B57795', display: 'flex' }}><X size={16} /></button>
            </div>

            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#9D5577' }}>Profe</label>
                <select value={form.profe} onChange={e => setForm({ ...form, profe: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #FBCFE8', fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
                  {PROFES.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ width: 110 }}>
                <label style={{ fontSize: 12, color: '#9D5577' }}>Hora</label>
                <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #FBCFE8', fontFamily: 'inherit', fontSize: 13 }} />
              </div>
            </div>

            <label style={{ fontSize: 12, color: '#9D5577' }}>Alumnos ({form.alumnos.length})</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar alumno…"
              style={{ width: '100%', margin: '4px 0 8px', padding: '8px 10px', borderRadius: 8, border: '1px solid #FBCFE8', fontFamily: 'inherit', fontSize: 13 }} />
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #FCE7F3', borderRadius: 8 }}>
              {clientesOrdenados.map(c => {
                const sel = form.alumnos.includes(c.id)
                const esDelDia = c.horario.includes(form.dia)
                return (
                  <button type="button" key={c.id} onClick={() => toggleAlumno(c.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: 'none', borderBottom: '1px solid #FDF2F8', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', background: sel ? '#FCE7F3' : '#fff' }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: '1px solid ' + (sel ? '#EC4899' : '#FBCFE8'), background: sel ? '#EC4899' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>{sel ? '✓' : ''}</span>
                    <span style={{ flex: 1, color: '#374151' }}>{c.nombre || c.telefono}</span>
                    {esDelDia && <span style={{ fontSize: 10, fontWeight: 700, color: '#DB2777', background: '#FCE7F3', borderRadius: 5, padding: '1px 6px' }}>viene {DIA_LABEL[form.dia]}</span>}
                  </button>
                )
              })}
              {clientesOrdenados.length === 0 && <p style={{ fontSize: 12, color: '#C99BB4', textAlign: 'center', padding: '14px 0' }}>Sin clientes</p>}
            </div>

            <button type="submit" style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 9, border: 'none', background: '#EC4899', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
          </form>
        </div>
      )}
    </div>
  )
}
