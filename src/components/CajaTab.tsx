'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCLP } from '@/lib/finanzas'
import { todaySantiago } from '@/lib/fechas'
import { Trash2 } from 'lucide-react'

type Mov = { id: number; fecha: string; tipo: 'gasto' | 'ingreso'; monto: number; categoria: string | null; descripcion: string | null; origen: string | null; chat_id: string | null }

const ORIGEN_ICON: Record<string, string> = { texto: '💬', audio: '🎙️', foto: '📷' }

export default function CajaTab({ mes }: { mes: string }) {
  const [movs, setMovs] = useState<Mov[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/movimientos?mes=${mes}`).then(r => r.json())
      if (d.ok) setMovs(d.movimientos)
    } finally { setLoading(false) }
  }, [mes])
  useEffect(() => { load() }, [load])

  async function del(id: number) {
    if (!confirm('¿Borrar este movimiento?')) return
    if ((await fetch(`/api/movimientos/${id}`, { method: 'DELETE' }).then(r => r.json())).ok) load()
  }

  const hoy = todaySantiago()
  const sum = (list: Mov[], tipo: 'gasto' | 'ingreso') => list.filter(m => m.tipo === tipo).reduce((s, m) => s + m.monto, 0)
  const movsHoy = useMemo(() => movs.filter(m => m.fecha.startsWith(hoy)), [movs, hoy])

  const totales = (list: Mov[]) => {
    const g = sum(list, 'gasto'); const i = sum(list, 'ingreso')
    return { gasto: g, ingreso: i, saldo: i - g }
  }
  const tHoy = totales(movsHoy); const tMes = totales(movs)

  // por categoría (gasto e ingreso por separado)
  const porCategoria = useMemo(() => {
    const m = new Map<string, { gasto: number; ingreso: number }>()
    for (const x of movs) {
      const k = x.categoria || '(sin categoría)'
      const g = m.get(k) ?? { gasto: 0, ingreso: 0 }
      if (x.tipo === 'gasto') g.gasto += x.monto; else g.ingreso += x.monto
      m.set(k, g)
    }
    return [...m.entries()].sort((a, b) => (b[1].gasto + b[1].ingreso) - (a[1].gasto + a[1].ingreso))
  }, [movs])

  function Card({ titulo, t }: { titulo: string; t: { gasto: number; ingreso: number; saldo: number } }) {
    return (
      <div style={{ flex: 1, minWidth: 200, background: '#fff', border: '1px solid #FBCFE8', borderRadius: 14, padding: '14px 16px' }}>
        <p style={{ fontSize: 12, color: '#9D5577', marginBottom: 8, fontWeight: 600 }}>{titulo}</p>
        <div className="flex gap-4">
          <div><p style={{ fontSize: 11, color: '#9D5577' }}>Gastos</p><p style={{ fontSize: 16, fontWeight: 800, color: '#BE185D' }}>{formatCLP(t.gasto)}</p></div>
          <div><p style={{ fontSize: 11, color: '#9D5577' }}>Ingresos</p><p style={{ fontSize: 16, fontWeight: 800, color: '#15803D' }}>{formatCLP(t.ingreso)}</p></div>
          <div><p style={{ fontSize: 11, color: '#9D5577' }}>Saldo</p><p style={{ fontSize: 16, fontWeight: 800, color: t.saldo >= 0 ? '#15803D' : '#DC2626' }}>{formatCLP(t.saldo)}</p></div>
        </div>
      </div>
    )
  }

  if (loading) return <p style={{ color: '#B57795', fontSize: 13 }}>Cargando…</p>

  return (
    <div>
      <div className="flex gap-3" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        <Card titulo="Hoy" t={tHoy} />
        <Card titulo="Mes" t={tMes} />
      </div>

      {porCategoria.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FBCFE8', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#831843', marginBottom: 8 }}>Por categoría</p>
          {porCategoria.map(([cat, v]) => (
            <div key={cat} className="flex items-center" style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #FDF2F8' }}>
              <span style={{ flex: 1, color: '#6B5563' }}>{cat}</span>
              {v.gasto > 0 && <span style={{ color: '#BE185D', fontWeight: 600, marginLeft: 10 }}>−{formatCLP(v.gasto)}</span>}
              {v.ingreso > 0 && <span style={{ color: '#15803D', fontWeight: 600, marginLeft: 10 }}>+{formatCLP(v.ingreso)}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #FBCFE8', borderRadius: 12, overflow: 'hidden' }}>
        {movs.length === 0 ? <p style={{ fontSize: 13, color: '#C99BB4', textAlign: 'center', padding: '24px 0' }}>Sin movimientos este mes. Tu mamá los registra por Telegram 💬</p>
          : movs.map(m => (
            <div key={m.id} className="flex items-center gap-3" style={{ padding: '9px 14px', borderBottom: '1px solid #FDF2F8', fontSize: 12 }}>
              <span title={m.origen ?? ''} style={{ fontSize: 14 }}>{ORIGEN_ICON[m.origen ?? ''] ?? '•'}</span>
              <span style={{ color: '#9D5577', width: 96 }}>{m.fecha.slice(0, 16)}</span>
              <span style={{ flex: 1, color: '#374151' }}>{m.categoria || '—'}{m.descripcion ? ` · ${m.descripcion}` : ''}</span>
              <span style={{ fontWeight: 700, color: m.tipo === 'gasto' ? '#BE185D' : '#15803D' }}>
                {m.tipo === 'gasto' ? '−' : '+'}{formatCLP(m.monto)}
              </span>
              <button onClick={() => del(m.id)} title="Borrar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#D98BB0' }}><Trash2 size={13} /></button>
            </div>
          ))}
      </div>
    </div>
  )
}
