'use client'

import { useEffect, useMemo, useState } from 'react'
import AppNav from '@/components/AppNav'
import { Search, UserRound, Baby } from 'lucide-react'

type Contacto = {
  id: number
  telefono: string
  nombre: string | null
  email: string | null
  estado: string | null
  alumnos: string | null
}

type Filtro = 'todos' | 'activo' | 'inactivo'

function esActivo(c: Contacto) { return (c.estado ?? '').toLowerCase() === 'activo' }

export default function ContactosPage() {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/contactos').then(r => r.json()).then(d => {
      if (d.ok) setContactos(d.contactos)
    }).finally(() => setCargando(false))
  }, [])

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const filtrados = useMemo(() => {
    const query = norm(q.trim())
    return contactos.filter(c => {
      if (filtro === 'activo' && !esActivo(c)) return false
      if (filtro === 'inactivo' && esActivo(c)) return false
      if (!query) return true
      return norm(`${c.nombre ?? ''} ${c.alumnos ?? ''} ${c.telefono}`).includes(query)
    })
  }, [contactos, q, filtro])

  const activos = contactos.filter(esActivo).length
  const inactivos = contactos.length - activos

  async function toggle(c: Contacto) {
    const nuevo = esActivo(c) ? 'inactivo' : 'activo'
    setGuardando(c.telefono)
    // Optimista
    setContactos(prev => prev.map(x => x.telefono === c.telefono ? { ...x, estado: nuevo } : x))
    try {
      const r = await fetch('/api/contactos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: c.telefono, estado: nuevo }),
      }).then(r => r.json())
      if (!r.ok) throw new Error()
    } catch {
      // Revertir si falla
      setContactos(prev => prev.map(x => x.telefono === c.telefono ? { ...x, estado: c.estado } : x))
    } finally {
      setGuardando(null)
    }
  }

  const chip = (f: Filtro, label: string, n: number) => (
    <button onClick={() => setFiltro(f)}
      style={{
        padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all .15s',
        border: '1px solid ' + (filtro === f ? '#EC4899' : '#FAD1E5'),
        background: filtro === f ? '#EC4899' : '#fff',
        color: filtro === f ? '#fff' : '#BE185D',
      }}>
      {label} <span style={{ opacity: .7 }}>{n}</span>
    </button>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="shrink-0" style={{ padding: '16px 20px', borderBottom: '1px solid #FAD1E5', background: '#FFFFFF' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#9D174D', margin: 0 }}>Contactos</h1>
          <p style={{ fontSize: 12, color: '#B0708C', margin: '4px 0 12px' }}>
            Tus apoderados de Arteluk. Toca la etiqueta para marcarlos activos o no activos.
          </p>
          <div style={{ position: 'relative', maxWidth: 420 }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: 10, color: '#CE8AAE' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por apoderado, niño o teléfono…"
              style={{ width: '100%', borderRadius: 10, border: '1px solid #FAD1E5', padding: '8px 12px 8px 32px', fontSize: 13, outline: 'none', color: '#374151' }} />
          </div>
          <div className="flex" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {chip('todos', 'Todos', contactos.length)}
            {chip('activo', 'Activos', activos)}
            {chip('inactivo', 'No activos', inactivos)}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '14px 20px', maxWidth: 720, width: '100%', margin: '0 auto' }}>
          {cargando && <p style={{ color: '#C0879F', fontSize: 13 }}>Cargando contactos…</p>}
          {!cargando && filtrados.length === 0 && (
            <p style={{ color: '#C0879F', fontSize: 13 }}>No hay contactos que coincidan.</p>
          )}
          <div className="flex flex-col" style={{ gap: 8 }}>
            {filtrados.map(c => {
              const activo = esActivo(c)
              return (
                <div key={c.id} className="flex items-center"
                  style={{ gap: 12, padding: '11px 14px', borderRadius: 12, border: '1px solid #FAD1E5', background: '#fff' }}>
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#FDE7F1', color: '#BE185D', fontWeight: 700, fontSize: 15 }}>
                    {(c.nombre ?? '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <UserRound size={13} style={{ color: '#CE8AAE' }} /> {c.nombre ?? '(sin nombre)'}
                    </p>
                    {c.alumnos && (
                      <p style={{ fontSize: 12, color: '#B0708C', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Baby size={12} style={{ color: '#CE8AAE' }} /> {c.alumnos}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: '#C0879F', margin: '3px 0 0' }}>+{c.telefono}</p>
                  </div>
                  <button onClick={() => toggle(c)} disabled={guardando === c.telefono} title="Cambiar etiqueta"
                    style={{
                      flexShrink: 0, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      cursor: guardando === c.telefono ? 'wait' : 'pointer', fontFamily: 'inherit',
                      border: '1px solid ' + (activo ? '#BBF7D0' : '#FED7AA'),
                      background: activo ? '#DCFCE7' : '#FFEDD5',
                      color: activo ? '#15803D' : '#C2410C',
                      opacity: guardando === c.telefono ? 0.6 : 1,
                    }}>
                    {activo ? '● Activo' : '○ No activo'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
