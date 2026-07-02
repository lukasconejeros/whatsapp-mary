'use client'

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import { RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

type Status = 'disconnected' | 'qr' | 'connecting' | 'connected' | 'unknown'

export default function ConexionPage() {
  const [status, setStatus] = useState<Status>('unknown')
  const [qrPng, setQrPng] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/connection/status', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as { status: Status; qrPng?: string; phone?: string }
      setStatus(data.status)
      setQrPng(data.qrPng ?? null)
      setPhone(data.phone ?? null)
      if (data.status === 'connected') setRegenerating(false)
    } catch { /* keep state */ }
  }, [])

  useEffect(() => { poll(); const t = setInterval(poll, 2000); return () => clearInterval(t) }, [poll])

  async function regenerar() {
    if (regenerating) return
    if (!confirm('Esto cerrará la sesión actual de WhatsApp y generará un código QR nuevo para volver a vincular. ¿Continuar?')) return
    setRegenerating(true); setQrPng(null); setStatus('connecting')
    try { await fetch('/api/connection/disconnect', { method: 'POST' }) } catch { /* */ }
  }

  const connected = status === 'connected'
  const conf = connected
    ? { color: '#16A34A', bg: '#F0FDF4', bd: '#86EFAC', Icon: Wifi, label: 'Conectado' }
    : status === 'connecting' || status === 'qr'
      ? { color: '#B45309', bg: '#FFFBEB', bd: '#FDE68A', Icon: AlertTriangle, label: status === 'qr' ? 'Esperando escaneo' : 'Conectando…' }
      : { color: '#B45309', bg: '#FFFBEB', bd: '#FDE68A', Icon: WifiOff, label: 'Desconectado' }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FBF7F9' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center shrink-0" style={{ height: 56, padding: '0 28px', background: '#fff', borderBottom: '1px solid #EBDCE3' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#4A2E39', letterSpacing: '-0.01em' }}>Conexión</h1>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '28px' }}>
          <div style={{ maxWidth: 460, margin: '0 auto' }}>

            {/* Estado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 12, background: conf.bg, border: `1px solid ${conf.bd}`, marginBottom: 20 }}>
              <conf.Icon size={20} style={{ color: conf.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: conf.color }}>{conf.label}</p>
                {connected && phone && <p style={{ fontSize: 12, color: '#15803D', marginTop: 1 }}>+{phone}</p>}
              </div>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: conf.color, boxShadow: `0 0 0 3px ${conf.bg}` }} />
            </div>

            {/* Tarjeta principal */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EBDCE3', boxShadow: '0 1px 3px rgba(30,58,95,0.06)', padding: '28px', textAlign: 'center' }}>
              {connected ? (
                <>
                  <p style={{ fontSize: 14, color: '#4A2E39', fontWeight: 600, marginBottom: 6 }}>WhatsApp vinculado y funcionando ✅</p>
                  <p style={{ fontSize: 13, color: '#64748B', marginBottom: 22, lineHeight: 1.55 }}>
                    Si cambiaste de teléfono o necesitas vincular otro número, genera un código nuevo.
                  </p>
                </>
              ) : qrPng ? (
                <>
                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #F3E7EC', padding: 12, display: 'inline-block', marginBottom: 18 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrPng} alt="QR de WhatsApp" width={260} height={260} style={{ display: 'block', borderRadius: 6 }} />
                  </div>
                  <ol style={{ textAlign: 'left', fontSize: 13, color: '#334155', lineHeight: 1.7, paddingLeft: 20, margin: '0 0 8px' }}>
                    <li>Abre <strong>WhatsApp</strong> en el teléfono de la clínica</li>
                    <li><strong>Ajustes → Dispositivos vinculados → Vincular un dispositivo</strong></li>
                    <li>Escanea este código</li>
                  </ol>
                </>
              ) : (
                <div style={{ padding: '30px 0' }}>
                  <div style={{ width: 26, height: 26, margin: '0 auto 12px', border: '3px solid #F3E7EC', borderTopColor: '#B76E79', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <p style={{ fontSize: 13, color: '#64748B' }}>{regenerating ? 'Generando código nuevo…' : 'Generando código QR…'}</p>
                </div>
              )}

              <button onClick={regenerar} disabled={regenerating}
                className="flex items-center justify-center gap-1.5"
                style={{ width: '100%', marginTop: 16, height: 38, borderRadius: 8, border: '1px solid #EBDCE3',
                  background: connected ? '#fff' : '#B76E79', color: connected ? '#B76E79' : '#fff',
                  fontSize: 13, fontWeight: 600, cursor: regenerating ? 'wait' : 'pointer', opacity: regenerating ? 0.6 : 1, fontFamily: 'inherit' }}>
                <RefreshCw size={13} className={regenerating ? 'spin' : ''} />
                {connected ? 'Vincular otro número (nuevo QR)' : 'Generar código QR nuevo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
