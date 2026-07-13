'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCLP } from '@/lib/finanzas'

type Ing = { id: number; fecha: string; apoderado: string | null; monto: number; tipo: string | null; detalle: string | null }
type Cos = { id: number; fecha: string; tipo: string | null; cantidad: number | null; valor: number; notas: string | null }

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function porTipo(items: { tipo: string | null; valor: number }[]): [string, number][] {
  const m = new Map<string, number>()
  for (const x of items) {
    const k = x.tipo?.trim() || '(sin categoría)'
    m.set(k, (m.get(k) ?? 0) + x.valor)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export default function MetricasTab() {
  const [desde, setDesde] = useState(firstOfMonth())
  const [hasta, setHasta] = useState(today())
  const [ingresos, setIngresos] = useState<Ing[]>([])
  const [costos, setCostos] = useState<Cos[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/finanzas/rango?desde=${desde}&hasta=${hasta}`).then(r => r.json())
      if (d.ok) { setIngresos(d.ingresos); setCostos(d.costos) }
    } finally { setLoading(false) }
  }, [desde, hasta])
  useEffect(() => { load() }, [load])

  const totalIng = useMemo(() => ingresos.reduce((s, i) => s + i.monto, 0), [ingresos])
  const totalCos = useMemo(() => costos.reduce((s, c) => s + c.valor, 0), [costos])
  const ganancia = totalIng - totalCos
  const ingPorTipo = useMemo(() => porTipo(ingresos.map(i => ({ tipo: i.tipo, valor: i.monto }))), [ingresos])
  const cosPorTipo = useMemo(() => porTipo(costos.map(c => ({ tipo: c.tipo, valor: c.valor }))), [costos])

  const preset = (dd: string, hh: string) => { setDesde(dd); setHasta(hh) }
  function ultimosDias(n: number) {
    const h = new Date()
    const d = new Date(h.getTime() - (n - 1) * 86400000)
    preset(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, today())
  }

  const inputStyle: React.CSSProperties = { height: 34, borderRadius: 9, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#054D44', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      {/* Filtro de fechas dinámico */}
      <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#667781' }}>Del</span>
        <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} style={inputStyle} />
        <span style={{ fontSize: 12, color: '#667781' }}>al</span>
        <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} style={inputStyle} />
        <div style={{ width: 8 }} />
        <button onClick={() => ultimosDias(7)} style={presetBtn}>7 días</button>
        <button onClick={() => ultimosDias(30)} style={presetBtn}>30 días</button>
        <button onClick={() => preset(firstOfMonth(), today())} style={presetBtn}>Este mes</button>
        <button onClick={() => preset(`${new Date().getFullYear()}-01-01`, today())} style={presetBtn}>Este año</button>
      </div>

      {loading ? <p style={{ color: '#8696A0', fontSize: 13 }}>Cargando…</p> : (
        <>
          {/* Tarjetas de totales */}
          <div className="flex gap-3" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
            {[
              { l: 'Ingresos', v: totalIng, c: '#15803D', bg: '#F0FDF4', bd: '#BBF7D0', n: ingresos.length },
              { l: 'Costos', v: totalCos, c: '#008069', bg: '#E7F1EC', bd: '#D3E7DE', n: costos.length },
              { l: 'Ganancia neta', v: ganancia, c: ganancia >= 0 ? '#15803D' : '#DC2626', bg: '#FFFFFF', bd: '#D3E7DE', n: null },
            ].map(card => (
              <div key={card.l} style={{ flex: 1, minWidth: 160, background: card.bg, border: `1px solid ${card.bd}`, borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 12, color: '#667781', marginBottom: 6 }}>{card.l}{card.n !== null && <span style={{ color: '#8696A0' }}> · {card.n}</span>}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: card.c, letterSpacing: '-0.02em' }}>{formatCLP(card.v)}</p>
              </div>
            ))}
          </div>

          {/* Desglose por categoría */}
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <Breakdown titulo="Ingresos por categoría" rows={ingPorTipo} color="#15803D" signo="+" total={totalIng} />
            <Breakdown titulo="Costos por categoría" rows={cosPorTipo} color="#008069" signo="−" total={totalCos} />
          </div>
        </>
      )}
    </div>
  )
}

const presetBtn: React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 999, border: '1px solid #D3E7DE', background: '#fff', color: '#667781', cursor: 'pointer', fontFamily: 'inherit' }

function Breakdown({ titulo, rows, color, signo, total }: { titulo: string; rows: [string, number][]; color: string; signo: string; total: number }) {
  return (
    <div style={{ flex: 1, minWidth: 240, background: '#fff', border: '1px solid #D3E7DE', borderRadius: 12, padding: '12px 16px' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#054D44', marginBottom: 8 }}>{titulo}</p>
      {rows.length === 0 ? <p style={{ fontSize: 12, color: '#8696A0' }}>Nada en este rango.</p>
        : rows.map(([cat, v]) => (
          <div key={cat} className="flex items-center" style={{ fontSize: 12, padding: '5px 0', borderBottom: '1px solid #E7F1EC' }}>
            <span style={{ flex: 1, color: '#6B5563' }}>{cat}</span>
            <span style={{ color, fontWeight: 700, marginLeft: 10 }}>{signo}{formatCLP(v)}</span>
            <span style={{ color: '#8696A0', fontSize: 11, marginLeft: 8, width: 38, textAlign: 'right' }}>{total > 0 ? Math.round((v / total) * 100) : 0}%</span>
          </div>
        ))}
    </div>
  )
}
