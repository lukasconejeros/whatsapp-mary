'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppNav from '@/components/AppNav'
import MetricasTab from '@/components/MetricasTab'
import { INGRESO_TIPOS, COSTO_TIPOS, formatCLP, currentMonth, shiftMonth, monthLabel } from '@/lib/finanzas'
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil, X, Upload } from 'lucide-react'

type Mov = { id: number; fecha: string; tipo: string | null; detalle?: string | null; apoderado?: string | null; notas?: string | null; monto?: number; valor?: number; cantidad?: number | null }

export default function FinanzasPage() {
  const [mes, setMes] = useState(currentMonth())
  const [tab, setTab] = useState<'ganancias' | 'costos' | 'metricas'>('ganancias')
  const [ingresos, setIngresos] = useState<Mov[]>([])
  const [costos, setCostos] = useState<Mov[]>([])
  const [loading, setLoading] = useState(true)
  const [openTipo, setOpenTipo] = useState<string | null>(null)
  const [orden, setOrden] = useState<'fecha' | 'nombre'>('fecha')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), tipo: '', monto: '', detalle: '' })
  const [guardando, setGuardando] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<null | { ingresosNuevos: number; costosNuevos: number; comisiones: number; duplicados: number; omitidos: number }>(null)

  async function importarCartola() {
    if (importing || !importText.trim()) return
    setImporting(true); setImportResult(null)
    try {
      const d = await fetch('/api/finanzas/importar-cartola', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: importText }) }).then(r => r.json())
      if (d.ok) { setImportResult(d); setImportText(''); load() }
      else alert(d.error || 'No se pudo importar')
    } catch { alert('No se pudo importar. Revisa tu internet.') }
    finally { setImporting(false) }
  }

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

  // Nombre/detalle visible de un movimiento (para ordenar alfabéticamente).
  const nombreDe = (r: Mov) => (r.detalle || r.apoderado || r.notas || '').trim()

  // Agrupar por tipo (grupos ordenados por monto desc); los ítems de cada grupo se
  // ordenan según la elección de la usuaria: por fecha (recientes primero) o A→Z.
  const grupos = useMemo(() => {
    const m = new Map<string, { total: number; items: Mov[] }>()
    for (const r of rows) {
      const k = r.tipo || '(sin categoría)'
      const g = m.get(k) ?? { total: 0, items: [] }
      g.total += amount(r); g.items.push(r); m.set(k, g)
    }
    for (const g of m.values()) {
      g.items.sort((a, b) =>
        orden === 'fecha'
          ? (b.fecha || '').localeCompare(a.fecha || '')
          : nombreDe(a).localeCompare(nombreDe(b), 'es', { sensitivity: 'base' }))
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [rows, tab, orden])

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return // evita doble registro por doble toque
    const monto = parseInt(form.monto.replace(/\D/g, ''), 10)
    if (!form.fecha || !monto) return
    setGuardando(true)
    try {
      const baseUrl = tab === 'ganancias' ? '/api/ingresos' : '/api/costos'
      const url = editId ? `${baseUrl}/${editId}` : baseUrl
      const body = tab === 'ganancias'
        ? { fecha: form.fecha, tipo: form.tipo, monto, detalle: form.detalle }
        : { fecha: form.fecha, tipo: form.tipo, valor: monto, notas: form.detalle }
      const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if ((await r.json()).ok) { closeForm(); load() }
      else alert('No se pudo guardar. Reintenta.')
    } catch { alert('No se pudo guardar. Revisa tu internet.') }
    finally { setGuardando(false) }
  }

  async function del(r: Mov) {
    if (!confirm('¿Borrar este registro? No se puede deshacer.')) return
    const url = tab === 'ganancias' ? `/api/ingresos/${r.id}` : `/api/costos/${r.id}`
    try {
      if ((await fetch(url, { method: 'DELETE' }).then(x => x.json())).ok) load()
      else alert('No se pudo borrar. Reintenta.')
    } catch { alert('No se pudo borrar. Revisa tu internet.') }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Cabecera con selector de mes */}
        <header className="flex items-center gap-3 shrink-0" style={{ height: 48, padding: '0 20px', background: '#FFFFFF', borderBottom: '1px solid #D3E7DE' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#054D44' }}>Finanzas</span>
          <div className="flex items-center gap-1" style={{ marginLeft: 8 }}>
            <button onClick={() => setMes(m => shiftMonth(m, -1))} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#00A884' }}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#054D44', minWidth: 130, textAlign: 'center' }}>{monthLabel(mes)}</span>
            <button onClick={() => setMes(m => shiftMonth(m, 1))} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#00A884' }}><ChevronRight size={18} /></button>
          </div>
          <div className="flex-1" />
          <button onClick={() => { setShowImport(true); setImportResult(null) }} className="flex items-center gap-1.5" title="Importar movimientos desde la cartola de MercadoPago"
            style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#008069', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Upload size={13} /> Importar cartola
          </button>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '18px 20px' }}>
          {/* Resumen del mes (solo Ganancias/Costos; Métricas tiene su propio filtro) */}
          {tab !== 'metricas' && (
          <div className="flex gap-3" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
            {[
              { l: 'Ingresos', v: totalIng, c: '#15803D', bg: '#F0FDF4', bd: '#BBF7D0' },
              { l: 'Costos', v: totalCos, c: '#008069', bg: '#E7F1EC', bd: '#D3E7DE' },
              { l: 'Ganancia neta', v: ganancia, c: ganancia >= 0 ? '#15803D' : '#DC2626', bg: '#FFFFFF', bd: '#D3E7DE' },
            ].map(card => (
              <div key={card.l} style={{ flex: 1, minWidth: 160, background: card.bg, border: `1px solid ${card.bd}`, borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 12, color: '#667781', marginBottom: 6 }}>{card.l}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: card.c, letterSpacing: '-0.02em' }}>{formatCLP(card.v)}</p>
              </div>
            ))}
          </div>
          )}

          {/* Pestañas (envuelven en pantalla angosta para no salirse) */}
          <div className="flex items-center" style={{ marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
            {(['ganancias', 'costos', 'metricas'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setOpenTipo(null) }}
                style={{ padding: '6px 14px', borderRadius: 9, border: '1px solid #D3E7DE', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  background: tab === t ? '#00A884' : '#fff', color: tab === t ? '#fff' : '#667781' }}>
                {t === 'ganancias' ? 'Ganancias' : t === 'costos' ? 'Costos' : 'Métricas'}
              </button>
            ))}
            {tab !== 'metricas' && (
              <button onClick={openNew} className="flex items-center gap-1.5"
                style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 9, border: 'none', background: '#00A884', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,168,132,0.3)', whiteSpace: 'nowrap' }}>
                <Plus size={15} /> Agregar {tab === 'ganancias' ? 'ingreso' : 'costo'}
              </button>
            )}
          </div>

          {/* Caja (movimientos de Telegram) o lista por ítem (Ganancias/Costos) */}
          {tab === 'metricas' ? <MetricasTab />
            : loading ? <p style={{ color: '#8696A0', fontSize: 13 }}>Cargando…</p>
            : grupos.length === 0 ? <p style={{ color: '#9AA7AD', fontSize: 13 }}>Sin movimientos este mes.</p>
            : (<>
            <div className="flex items-center" style={{ gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: '#667781' }}>Ordenar:</span>
              {([['fecha', 'Fecha'], ['nombre', 'A → Z']] as const).map(([k, lbl]) => {
                const on = orden === k
                return (
                  <button key={k} onClick={() => setOrden(k)}
                    style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                      border: on ? '1px solid #00A884' : '1px solid #D3E7DE', background: on ? '#00A884' : '#fff', color: on ? '#fff' : '#667781' }}>
                    {lbl}
                  </button>
                )
              })}
            </div>
            {grupos.map(([tipo, g]) => (
              <div key={tipo} style={{ background: '#fff', border: '1px solid #D3E7DE', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                <button onClick={() => setOpenTipo(p => p === tipo ? null : tipo)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#054D44', flex: 1 }}>{tipo}</span>
                  <span style={{ fontSize: 11, color: '#8696A0' }}>{g.items.length} mov.</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#008069', minWidth: 110, textAlign: 'right' }}>{formatCLP(g.total)}</span>
                </button>
                {openTipo === tipo && (
                  <div style={{ borderTop: '1px solid #E7F1EC' }}>
                    {g.items.map(r => (
                      <div key={r.id} className="flex items-center gap-3" style={{ padding: '8px 16px', borderBottom: '1px solid #F3F9F6', fontSize: 12 }}>
                        <span style={{ color: '#667781', width: 78 }}>{r.fecha}</span>
                        <span style={{ flex: 1, color: '#6B5563' }}>{r.detalle || r.apoderado || r.notas || '—'}</span>
                        <span style={{ color: '#054D44', fontWeight: 600 }}>{formatCLP(amount(r))}</span>
                        <button onClick={() => openEdit(r)} title="Editar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5FB89E' }}><Pencil size={14} /></button>
                        <button onClick={() => del(r)} title="Borrar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#5FB89E' }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            </>)}
        </div>
      </div>

      {/* Modal agregar/editar */}
      {showForm && (
        <div onClick={closeForm} style={{ position: 'fixed', inset: 0, background: 'rgba(6,77,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitForm}
            style={{ background: '#fff', borderRadius: 16, padding: 20, width: 360, boxShadow: '0 20px 50px rgba(6,77,68,0.25)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#054D44' }}>{editId ? 'Editar' : 'Agregar'} {tab === 'ganancias' ? 'ingreso' : 'costo'}</p>
              <button type="button" onClick={closeForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#8696A0', display: 'flex' }}><X size={16} /></button>
            </div>
            <label style={{ fontSize: 12, color: '#667781' }}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
              style={{ width: '100%', margin: '4px 0 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13 }} />
            <label style={{ fontSize: 12, color: '#667781' }}>Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              style={{ width: '100%', margin: '4px 0 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
              <option value="">— elegir —</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: '#667781' }}>Monto (CLP)</label>
            <input inputMode="numeric" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0"
              style={{ width: '100%', margin: '4px 0 12px', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13 }} />
            <label style={{ fontSize: 12, color: '#667781' }}>Detalle</label>
            <input value={form.detalle} onChange={e => setForm({ ...form, detalle: e.target.value })} placeholder="opcional"
              style={{ width: '100%', margin: '4px 0 16px', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13 }} />
            <button type="submit" disabled={guardando} style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: '#00A884', color: '#fff', fontWeight: 700, fontSize: 14, cursor: guardando ? 'default' : 'pointer', opacity: guardando ? 0.6 : 1, fontFamily: 'inherit' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </form>
        </div>
      )}

      {showImport && (
        <div onClick={() => setShowImport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(5,77,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, border: '1px solid #D3E7DE', width: '100%', maxWidth: 460, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
              <p style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#054D44' }}>Importar cartola de MercadoPago</p>
              <button onClick={() => setShowImport(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8696A0' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 12, color: '#667781', marginBottom: 10 }}>Copia y pega la tabla de movimientos de tu cartola. Los abonos entran como <b>ingresos</b>, los pagos como <b>gastos</b>, y las transferencias enviadas (retiros) se omiten. No duplica lo ya cargado.</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Pega aquí los movimientos de la cartola…" rows={8}
              style={{ width: '100%', borderRadius: 8, border: '1px solid #D3E7DE', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
            {importResult && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 9, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', fontSize: 13 }}>
                ✅ Importado: {importResult.ingresosNuevos} ingresos y {importResult.costosNuevos} gastos
                {importResult.comisiones > 0 ? ` + ${importResult.comisiones} comisiones` : ''}.
                {importResult.duplicados > 0 ? ` (${importResult.duplicados} ya estaban).` : ''}
                {importResult.omitidos > 0 ? ` · ${importResult.omitidos} retiros omitidos.` : ''}
              </div>
            )}
            <button onClick={importarCartola} disabled={importing || !importText.trim()}
              style={{ width: '100%', marginTop: 14, padding: '10px', borderRadius: 9, border: 'none', background: '#00A884', color: '#fff', fontWeight: 700, fontSize: 14, cursor: importing || !importText.trim() ? 'default' : 'pointer', opacity: importing || !importText.trim() ? 0.6 : 1, fontFamily: 'inherit' }}>
              {importing ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
