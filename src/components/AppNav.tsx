'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessagesSquare, Users, Wallet, CalendarDays, Plug, Brush } from 'lucide-react'

const items = [
  { href: '/inbox',      Icon: MessagesSquare, label: 'Chats'      },
  { href: '/contactos',  Icon: Users,         label: 'Contactos'  },
  { href: '/finanzas',   Icon: Wallet,        label: 'Finanzas'   },
  { href: '/calendario', Icon: CalendarDays,  label: 'Calendario' },
  { href: '/conexion',   Icon: Plug,          label: 'Conexión'   },
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
    <>
    {/* Botón flotante del Asistente IA: pincel brillante, siempre visible */}
    <Link href="/asistente" className="asistente-fab" aria-label="Asistente IA" title="Asistente IA">
      <Brush size={24} strokeWidth={2.2} />
    </Link>

    <nav className="app-sidebar flex flex-col h-full shrink-0"
      style={{ width: 212, background: '#FFFFFF', borderRight: '1px solid #FAD1E5' }}>

      {/* Marca */}
      <div className="app-brand flex items-center gap-3" style={{ padding: '20px 18px 16px', borderBottom: '1px solid #FDE7F1' }}>
        <div className="flex items-center justify-center shrink-0"
          style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', border: '1px solid #FAD1E5', boxShadow: '0 4px 12px rgba(236,72,153,0.2)' }}>
          <Brush size={20} strokeWidth={2} style={{ color: '#EC4899' }} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#9D174D', lineHeight: 1.1, letterSpacing: '-0.01em' }}>Arteluk</p>
          <p style={{ fontSize: 11, color: '#C0879F', marginTop: 3, letterSpacing: '0.01em' }}>Panel de Mary</p>
        </div>
      </div>

      {/* Navegación */}
      <p className="app-menuLabel" style={{ fontSize: 10, fontWeight: 700, color: '#DBAFC6', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '16px 20px 6px' }}>Menú</p>
      <div className="app-navitems flex flex-col gap-1" style={{ padding: '0 10px' }}>
        {items.map(({ href, Icon, label }) => {
          const active = path.startsWith(href)
          const isConexion = href === '/conexion'
          const dotColor = connected === null ? null : connected ? '#22C55E' : '#F59E0B'
          return (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 transition-colors"
              style={{ padding: '8px 12px', fontSize: 13, fontWeight: active ? 600 : 450, borderRadius: 10,
                color: active ? '#BE185D' : '#6B5563',
                background: active ? '#FDE7F1' : 'transparent',
                boxShadow: active ? 'inset 0 0 0 1px #FAD1E5' : 'none',
                textDecoration: 'none' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#FFF4FA' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              <Icon size={15} strokeWidth={active ? 2.2 : 1.7} style={{ color: active ? '#EC4899' : '#CE8AAE' }} />
              <span style={{ flex: 1 }}>{label}</span>
              {isConexion && dotColor && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor,
                  boxShadow: connected ? '0 0 8px rgba(34,197,94,0.55)' : '0 0 0 3px rgba(245,158,11,0.2)',
                  animation: connected ? 'none' : 'pulse 1.6s ease-in-out infinite' }} />
              )}
            </Link>
          )
        })}
      </div>
      <div className="app-spacer flex-1" />

      {/* Banner de reconexión */}
      {connected === false && (
        <div className="app-reconnect" style={{ padding: '0 10px 10px' }}>
          <Link href="/conexion" style={{ textDecoration: 'none', display: 'block', padding: '10px 12px', borderRadius: 10,
            background: 'linear-gradient(135deg, #F59E0B, #F97316)', color: '#fff', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>⚠ WhatsApp desconectado</p>
            <p style={{ fontSize: 11, opacity: 0.9 }}>Toca para reconectar →</p>
          </Link>
        </div>
      )}

      {/* Pie */}
      <div className="app-footer" style={{ padding: '0 12px 16px' }}>
        <div style={{ padding: '10px 12px', borderRadius: 11, background: '#FFF4FA', border: '1px solid #FDE7F1' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#BE185D', marginBottom: 2 }}>Arteluk · academia de arte</p>
          <p style={{ fontSize: 11, color: '#C0879F' }}>Hecho con cariño 💕</p>
        </div>
      </div>
    </nav>
    </>
  )
}
