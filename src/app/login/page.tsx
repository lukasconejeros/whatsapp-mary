'use client'

import { useState } from 'react'
import { Brush, Lock } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (!password || cargando) return
    setCargando(true); setError('')
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const d = await r.json()
      if (r.ok && d.ok) {
        window.location.href = '/inbox'
      } else {
        setError(d.error || 'No se pudo entrar')
        setCargando(false)
      }
    } catch {
      setError('No se pudo conectar. Revisa tu internet.')
      setCargando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', padding: 20 }}>
      <form onSubmit={entrar} style={{ width: '100%', maxWidth: 360, background: '#fff', border: '1px solid #D3E7DE', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,168,132,0.12)', padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: '#fff', border: '1px solid #D3E7DE', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(0,168,132,0.25)' }}>
            <Brush size={20} strokeWidth={2} style={{ color: '#00A884' }} />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#054D44', lineHeight: 1.1 }}>Arteluk</p>
            <p style={{ fontSize: 11, color: '#8696A0' }}>Panel de Mary</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#667781', margin: '14px 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={14} /> Ingresa la contraseña para entrar.
        </p>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" autoFocus
          style={{ width: '100%', borderRadius: 10, border: '1px solid #D3E7DE', padding: '11px 13px', fontSize: 14, outline: 'none', color: '#374151' }} />
        {error && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 10 }}>{error}</p>}
        <button type="submit" disabled={cargando || !password}
          style={{ width: '100%', marginTop: 16, borderRadius: 10, border: 'none', background: '#00A884', color: '#fff', padding: '12px', fontSize: 14, fontWeight: 700, cursor: cargando || !password ? 'default' : 'pointer', opacity: cargando || !password ? 0.6 : 1 }}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
