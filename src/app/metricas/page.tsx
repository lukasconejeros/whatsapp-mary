'use client'

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import { RefreshCw, TrendingUp, Users, Calendar, CheckCircle, AlertCircle, MessageSquare, Bot } from 'lucide-react'

interface DLMetrics { agendadas: number; atendidas: number; canceladas: number; inasistencias: number; tasaAsistencia: number; tasaAusentismo: number; lastUpdated: string; cached: boolean; [k: string]: unknown }
interface CWMetrics { total: number; total30d: number; byState: { activo: number; derivado: number; agendado: number; cancelado: number; resuelto: number }; byChannel: { whatsapp: number; instagram: number; messenger: number; tiktok: number; unknown: number }; botActive: number; botOff: number; reactivados: number; sinRespuesta: number }

const CH_DOT: Record<string, string> = { whatsapp: '#22C55E', instagram: '#A855F7', messenger: '#3B82F6', tiktok: '#000000', unknown: '#9CA3AF' }
const CH_LABEL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', tiktok: 'TikTok', unknown: 'Otro' }

function KpiCard({ label, value, sub, icon: Icon, accent, loading }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent?: string; loading?: boolean }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', padding: '16px 18px' }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 'var(--radius-md)', background: accent ? `${accent}18` : 'var(--color-bg)' }}>
          <Icon size={13} style={{ color: accent || 'var(--color-ink-3)' }} />
        </span>
      </div>
      {loading ? <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-ink-4)' }}><RefreshCw size={12} className="spin" /><span style={{ fontSize: 12 }}>calculando...</span></div>
        : <><p style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ink-1)', lineHeight: 1 }}>{value}</p>{sub && <p style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 5 }}>{sub}</p>}</>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</span><div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} /></div>
}

export default function MetricasPage() {
  const [dl, setDl] = useState<DLMetrics | null>(null)
  const [cw, setCw] = useState<CWMetrics | null>(null)
  const [loadingDl, setLoadingDl] = useState(true)
  const [loadingCw, setLoadingCw] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadDl = useCallback(async () => { setLoadingDl(true); try { const d = await fetch('/api/metricas/dentalink').then(r => r.json()); if (d.ok) setDl(d) } finally { setLoadingDl(false) } }, [])
  const loadCw = useCallback(async () => { setLoadingCw(true); try { const d = await fetch('/api/metricas/chatwoot').then(r => r.json()); if (d.ok) setCw(d) } finally { setLoadingCw(false) } }, [])

  useEffect(() => { loadDl(); loadCw() }, [loadDl, loadCw])
  async function refresh() { setRefreshing(true); await Promise.all([loadDl(), loadCw()]); setRefreshing(false) }

  const totalCh = cw ? Object.values(cw.byChannel).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0" style={{ height: 48, padding: '0 20px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink-1)' }}>Métricas</span>
          <span style={{ fontSize: 12, color: 'var(--color-ink-3)' }}>últimos 30 días</span>
          <div className="flex-1" />
          <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5"
            style={{ height: 30, padding: '0 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 12, color: 'var(--color-ink-2)', cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.5 : 1 }}>
            <RefreshCw size={11} className={refreshing ? 'spin' : ''} />Actualizar
          </button>
        </header>
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Leads · Embudo de ventas</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <KpiCard label="Total leads" value={dl?.totalLeads as number ?? '—'} sub="en base de datos" icon={Users} loading={loadingDl} accent="#3B82F6" />
              <KpiCard label="Nuevos (30d)" value={dl?.leads30d as number ?? '—'} sub="últimos 30 días" icon={TrendingUp} loading={loadingDl} accent="#22C55E" />
              <KpiCard label="Demos agendadas" value={dl?.demos as number ?? '—'} sub="leads calificados" icon={Calendar} loading={loadingDl} accent="#8B5CF6" />
              <KpiCard label="Clientes" value={dl?.clientes as number ?? '—'} sub={dl && (dl.demos as number) > 0 ? `${Math.round(((dl.clientes as number) / (dl.demos as number)) * 100)}% conversión` : 'tasa de cierre'} icon={CheckCircle} loading={loadingDl} accent="#F59E0B" />
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Conversaciones · WhatsApp Bot</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <KpiCard label="Total" value={cw?.total ?? '—'} sub="conversaciones" icon={MessageSquare} loading={loadingCw} accent="#6366F1" />
              <KpiCard label="Activas (30d)" value={cw?.total30d ?? '—'} sub="actividad reciente" icon={TrendingUp} loading={loadingCw} accent="#3B82F6" />
              <KpiCard label="Bot activo" value={cw?.botActive ?? '—'} sub="modo IA" icon={Bot} loading={loadingCw} accent="#22C55E" />
              <KpiCard label="Sin respuesta" value={cw?.sinRespuesta ?? '—'} sub=">24h sin actividad" icon={AlertCircle} loading={loadingCw} accent="#EF4444" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', padding: '16px 18px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Por canal</p>
              {cw && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(cw.byChannel).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([ch, count]) => {
                  const pct = totalCh > 0 ? Math.round((count / totalCh) * 100) : 0
                  return <div key={ch}><div className="flex items-center justify-between" style={{ marginBottom: 4 }}><span className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--color-ink-2)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: CH_DOT[ch], display: 'inline-block' }} />{CH_LABEL[ch]}</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink-1)' }}>{count}</span></div><div style={{ height: 4, borderRadius: 99, background: 'var(--color-bg)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: CH_DOT[ch] }} /></div></div>
                })}
              </div>}
            </div>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', padding: '16px 18px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Estado del bot</p>
              {cw && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['Bot activo (IA)', cw.byState.activo, '#3B82F6'], ['Derivado a humano', cw.byState.derivado, '#8B5CF6'], ['Resueltos', cw.byState.resuelto, '#9CA3AF']].map(([label, count, color]) => (
                  <div key={label as string} className="flex items-center justify-between"><span className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--color-ink-2)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: color as string, display: 'inline-block' }} />{label as string}</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-ink-1)' }}>{count as number}</span></div>
                ))}
              </div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
