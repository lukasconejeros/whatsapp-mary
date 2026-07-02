'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppNav from '@/components/AppNav'
import CajaTab from '@/components/CajaTab'
import { INGRESO_TIPOS, COSTO_TIPOS, formatCLP, currentMonth, shiftMonth, monthLabel } from '@/lib/finanzas'
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil, X } from 'lucide-react'

type Mov = { id: number; fecha: string; tipo: string | null; detalle?: string | null; apoderado?: string | null; notas?: string | null; monto?: number; valor?: number; cantidad?: number | null }

export default function FinanzasPage() {
  const [mes, setMes] = useState(currentMonth())
  const [tab, setTab] = useState<'ganancias' | 'costos' | 'caja'>('ganancias')
  const [ingresos, setIngresos] = useState<Mov[]>([])
  const [costos, setCostos] = useState<Mov[]>([])
  const [loading, setLoading] = useState(true)
  const [openTipo, setOpenTipo] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), tipo: '', monto: '', detalle: '' })

  function openNew() {
    setEditId(null)
    setForm({ fecha: new Date().toISOString().slice(0, 10), tipo: '', monto: '', detalle: '' })
    setShowForm(true)
  }
  function openEdit(r: Mov) {
    setEditId(r.id)
    setForm({ fecha: r.fecha, tipo: r.tipo ?? '', monto: String(tab === 'ganancias' ? (r.monto ?? 0) : (r.valor ?? 0)), detalle: (r.detalle ?? r.notas ?? '') })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/finanzas?mes=${mes}`).then(r => r.json())
      if (d.ok) { setIngresos(d.ingresos); setCostos(d.costos) }
    } finally { setLoading(false) }
  }, [mes])
  useEffect(() => { load() }, [load])

  const totalIng = useMemo(() => ingresos.reduce((s, r) => s + (r.monto ?? 0), 0), [ingresos])
  const totalCos = useMemo(() => costos.reduce((s, r) => s + (r.valor ?? 0), 0), [costos])
  const ganancia = totalIng - totalCos

  const rows = tab === 'ganancias' ? ingresos : costos
  const amount = (r: Mov) => tab === 'ganancias' ? (r.monto ?? 0) : (r.valor ?? 0)
  const tipos = tab === 'ganancias' ? INGRESO_TIPOS : COSTO_TIPOS

  // Agrupar por tipo, ordenado por monto desc
  const grupos = useMemo(() => {
    const m = new Map<string, { total: number; items: Mov[] }>()
    for (const r of rows) {
      const k = r.tipo || '(sin categoría)'
      const g = m.get(k) ?? { total: 0, items: [] }
      g.total += amount(r); g.items.push(r); m.set(k, g)
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [rows, tab])

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    const monto = parseInt(form.monto.replace(/\D/g, ''), 10)
    if (!form.fecha || !monto) return
    const baseUrl = tab === 'ganancias' ? '/api/ingresos' : '/api/costos'
    const url = editId ? `${baseUrl}/${editId}` : baseUrl
    const body = tab === 'ganancias'
      ? { fecha: form.fecha, tipo: form.tipo, monto, detalle: form.detalle }
      : { fecha: form.fecha, tipo: form.tipo, valor: monto, notas: form.detalle }
    const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if ((await r.json()).ok) { closeForm(); load() }
  }

  async function del(r: Mov) {
    const url = tab === 'ganancias' ? `/api/ingresos/${r.id}` : `/api/costos/${r.id}`
    if ((await fetch(url, { method: 'DELETE' }).then(x => x.json())).ok) load()
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FBF7F9' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Cabecera con selector de mes */}
        <header className="flex items-center gap-3 shrink-0" style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #EBDCE3' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#4A2E39' }}>Finanzas</span>
          <div className="flex items-center gap-1" style={{ marginLeft: 8 }}>
            <button onClick={() => setMes(m => shiftMonth(m, -1))} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B76E79' }}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#4A2E39', minWidth: 130, textAlign: 'center' }}>{monthLabel(mes)}</span>
            <button onClick={() => setMes(m => shiftMonth(m, 1))} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B76E79' }}><ChevronRight size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '18px 20px' }}>
          {/* Resumen (solo Ganancias/Costos, no en Caja) */}
          {tab !== 'caja' && (
          <div className="flex gap-3" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
            {[
              { l: 'Ingresos', v: totalIng, c: '#15803D', bg: '#F0FDF4', bd: '#BBF7D0' },
              { l: 'Costos', v: totalCos, c: '#8E5563', bg: '#F3E7EC', bd: '#EBDCE3' },
              { l: 'Ganancia neta', v: ganancia, c: ganancia >= 0 ? '#15803D' : '#DC2626', bg: '#FFFFFF', bd: '#EBDCE3' },
            ].map(card => (
              <div key={card.l} style={{ flex: 1, minWidth: 160, background: card.bg, border: `1px solid ${card.bd}`, borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 12, color: '#8A7079', marginBottom: 6 }}>{card.l}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: card.c, letterSpacing: '-0.02em' }}>{formatCLP(card.v)}</p>
              </div>
            ))}
          </div>
          )}

          {/* Pestañas */}
          <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
            {(['ganancias', 'costos', 'caja'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setOpenTipo(null) }}
                style={{ padding: '6px 14px', borderRadius: 9, border: '1px solid #EBDCE3', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  background: tab === t ? '#B76E79' : '#fff', color: tab === t ? '#fff' : '#8A7079' }}>
                {t === 'ganancias' ? 'Ganancias' : t === 'costos' ? 'Costos' : 'Caja'}
              </button>
            ))}
            <div className="flex-1" />
            {tab !== 'caja' && (
              <button onClick={openNew} className="flex items-center gap-1.5"
                style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: '#B76E79', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(236,72,153,0.3)' }}>
                <Plus size={15} /> Agregar {tab === 'ganancias' ? 'ingreso' : 'costo'}
              </button>
            )}
          </div>

          {/* Caja (movimientos de Telegram) o lista por ítem (Ganancias/Costos) */}
          {tab === 'caja' ? <CajaTab mes={mes} />
            : loading ? <p style={{ color: '#9A8188', fontSize: 13 }}>Cargando…</p>
            : grupos.length === 0 ? <p style={{ color: '#B6A2AA', fontSize: 13 }}>Sin movimientos este mes.</p>
            : grupos.map(([tipo, g]) => (
              <div key={tipo} style={{ background: '#fff', border: '1px solid #EBDCE3', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                <button onClick={() => setOpenTipo(p => p === tipo ? null : tipo)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#4A2E39', flex: 1 }}>{tipo}</span>
                  <span style={{ fontSize: 11, color: '#9A8188' }}>{g.items.length} mov.</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#8E5563', minWidth: 110, textAlign: 'right' }}>{formatCLP(g.total)}</span>
                </button>
                {openTipo === tipo && (
                  <div style={{ borderTop: '1px solid #F3E7EC' }}>
                    {g.items.map(r => (
                      <div key={r.id} className="flex items-center gap-3" style={{ padding: '8px 16px', borderBottom: '1px solid #FBF7F9', fontSize: 12 }}>
                        <span style={{ color: '#8A7079', width: 78 }}>{r.fecha}</span>
                        <span style={{ flex: 1, color: '#6B5563' }}>{r.detalle || r.apoderado || r.notas || '—'}</span>
                        <span style={{ color: '#4A2E39', fontWeight: 600 }}>{formatCLP(amount(r))}</span>
                        <button onClick={() => openEdit(r)} title="Editar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#C08A9B' }}><Pencil size={14} /></button>
                        <button onClick={() => del(r)} title="Borrar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#C08A9B' }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Modal agregar/editar */}
      {showForm && (
        <div onClick={closeForm} style={{ position: 'fixed', inset: 0, background: 'rgba(131,24,67,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitForm}
            style={{ background: '#fff', borderRadius: 16, padding: 20, width: 360, boxShadow: '0 20px 50px rgba(131,24,67,0.25)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#4A2E39' }}>{editId ? 'Editar' : 'Agregar'} {tab === 'ganancias' ? 'ingreso' : 'costo'}</p>
              <button type="button" onClick={closeForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9A8188', display: 'flex' }}><X size={16} /></button>
            </div>
            <label style={{ fontSize: 12, color: '#8A7079' }}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
              style={{ width: '100%', margin: '4px 0 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid #EBDCE3', fontFamily: 'inherit', fontSize: 13 }} />
            <label style={{ fontSize: 12, color: '#8A7079' }}>Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              style={{ width: '100%', margin: '4px 0 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid #EBDCE3', fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
              <option value="">— elegir —</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: '#8A7079' }}>Monto (CLP)</label>
            <input inputMode="numeric" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0"
              style={{ width: '100%', margin: '4px 0 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid #EBDCE3', fontFamily: 'inherit', fontSize: 13 }} />
            <label style={{ fontSize: 12, color: '#8A7079' }}>Detalle</label>
            <input value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} placeholder="opcional"
              style={{ width: '100%', margin: '4px 0 16px', padding: '8px 10px', borderRadius: 8, border: '1px solid #EBDCE3', fontFamily: 'inherit', fontSize: 13 }} />
            <button type="submit" style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: '#B76E79', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
          </form>
        </div>
      )}
    </div>
  )
}
