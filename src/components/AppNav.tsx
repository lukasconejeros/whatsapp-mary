'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Columns3, BarChart2, Zap, Sparkles, Plug } from 'lucide-react'

const items = [
  { href: '/inbox',         Icon: Columns3,  label: 'Embudo'      },
  { href: '/configuracion', Icon: Sparkles,  label: 'Entrenar IA' },
  { href: '/conexion',      Icon: Plug,      label: 'Conexión'    },
  { href: '/metricas',      Icon: BarChart2, label: 'Métricas'    },
  { href: '/mejoras',       Icon: Zap,       label: 'Mejoras'     },
]

export default function AppNav() {
  const path = usePathname()
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const r = await fetch('/api/connection/status', { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json() as { status: string }
        if (mounted) setConnected(d.status === 'connected')
      } catch { /* keep */ }
    }
    poll(); const t = setInterval(poll, 4000); return () => { mounted = false; clearInterval(t) }
  }, [])

  return (
    <nav className="flex flex-col h-full shrink-0"
      style={{ width: 200, background: '#1E3A5F', borderRight: '1px solid #1D4ED8' }}>
      <div className="flex items-center gap-3" style={{ padding: '18px 18px', borderBottom: '1px solid #1D4ED8' }}>
        <div className="flex items-center justify-center shrink-0"
          style={{ width: 34, height: 34, borderRadius: 9, background: '#2563EB', color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', boxShadow: '0 2px 6px rgba(37,99,235,0.35)' }}>
          W
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#F8FAFF', lineHeight: 1.1, letterSpacing: '-0.01em' }}>Waly</p>
          <p style={{ fontSize: 11, color: '#93C5FD', marginTop: 3, letterSpacing: '0.01em' }}>Panel de gestión</p>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 p-2 mt-1">
        {items.map(({ href, Icon, label }) => {
          const active = path.startsWith(href)
          const isConexion = href === '/conexion'
          // Amarillo cuando está desconectado, verde cuando conectado
          const dotColor = connected === null ? null : connected ? '#22C55E' : '#F59E0B'
          return (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 rounded-md transition-colors"
              style={{ padding: '7px 10px', fontSize: 13, fontWeight: active ? 500 : 400,
                color: active ? '#EFF6FF' : '#93C5FD', background: active ? '#2563EB' : 'transparent', textDecoration: 'none' }}>
              <Icon size={14} strokeWidth={active ? 2 : 1.5} />
              <span style={{ flex: 1 }}>{label}</span>
              {isConexion && dotColor && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor,
                  boxShadow: connected ? 'none' : '0 0 0 3px rgba(245,158,11,0.25)',
                  animation: connected ? 'none' : 'pulse 1.6s ease-in-out infinite' }} />
              )}
            </Link>
          )
        })}
      </div>
      <div className="flex-1" />

      {/* Banner amarillo cuando está desconectado */}
      {connected === false && (
        <div className="p-2">
          <Link href="/conexion" style={{ textDecoration: 'none', display: 'block', padding: '10px 12px', borderRadius: 8, background: '#F59E0B', color: '#fff' }}>
            <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>⚠ WhatsApp desconectado</p>
            <p style={{ fontSize: 11, opacity: 0.9 }}>Toca para reconectar →</p>
          </Link>
        </div>
      )}

      <div className="p-3 pb-4">
        <div style={{ padding: '8px 10px', borderRadius: 6, background: '#1D4ED8', border: '1px solid #2563EB' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#DBEAFE', marginBottom: 2 }}>Pro AI</p>
          <p style={{ fontSize: 11, color: '#93C5FD' }}>4 canales activos</p>
        </div>
      </div>
    </nav>
  )
}
