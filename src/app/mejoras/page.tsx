'use client'

import AppNav from '@/components/AppNav'
import { Sparkles, Download, RefreshCw, Target, BarChart2 } from 'lucide-react'

const items = [
  { Icon: Sparkles,  title: 'IA sugiere respuestas',   desc: 'Cuando el bot está apagado, la IA analiza el contexto y te sugiere qué responder, listo para enviar.', active: true },
  { Icon: RefreshCw, title: 'Reactivar conversación',  desc: 'Vuelve a encender el bot en conversaciones derivadas a humano con un solo clic desde el embudo.', active: true },
  { Icon: BarChart2, title: 'Métricas de conversión',  desc: 'Tasa de leads calificados, demos agendadas y clientes cerrados, calculado desde tu base de datos.', active: true },
  { Icon: Download,  title: 'Exportar leads a CSV',    desc: 'Descarga todos tus leads con sus datos de contacto, dolor y estado en un archivo Excel.', active: false },
  { Icon: Target,    title: 'Mover lead por embudo',   desc: 'Arrastra conversaciones entre columnas del embudo directamente desde el panel.', active: false },
]

export default function MejorasPage() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <AppNav />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center shrink-0"
          style={{ height: 56, padding: '0 28px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink-1)', letterSpacing: '-0.01em' }}>Mejoras</h1>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '32px 28px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>

            {/* Intro */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink-1)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Funciones del sistema
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', marginTop: 6, lineHeight: 1.55 }}>
                Capacidades activas en tu panel y mejoras que vienen en camino.
              </p>
            </div>

            {/* Activas */}
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Activas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {items.filter(i => i.active).map(it => <Card key={it.title} {...it} />)}
            </div>

            {/* Próximamente */}
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Próximamente
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.filter(i => !i.active).map(it => <Card key={it.title} {...it} />)}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ Icon, title, desc, active }: { Icon: React.ElementType; title: string; desc: string; active: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px',
      background: 'var(--color-surface)', borderRadius: 12,
      border: '1px solid var(--color-border)',
      boxShadow: '0 1px 2px rgba(30,58,95,0.04)',
      opacity: active ? 1 : 0.72,
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
        background: active ? 'var(--color-blue)' : '#E2E8F0',
      }}>
        <Icon size={17} strokeWidth={2} style={{ color: active ? '#fff' : '#94A3B8' }} />
      </span>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink-1)', letterSpacing: '-0.01em' }}>{title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.02em',
            background: active ? '#F0FDF4' : '#F1F5F9',
            color: active ? '#16A34A' : '#94A3B8',
          }}>
            {active ? 'Activo' : 'Pronto'}
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>{desc}</p>
      </div>
    </div>
  )
}
