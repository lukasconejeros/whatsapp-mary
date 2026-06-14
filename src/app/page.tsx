'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'disconnected' | 'qr' | 'connecting' | 'connected' | 'unknown'

export default function Home() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('unknown')
  const [qrPng, setQrPng] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const res = await fetch('/api/connection/status', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as { status: Status; qrPng?: string }
        if (!mounted) return
        if (data.status === 'connected') { router.replace('/inbox'); return }
        setStatus(data.status)
        setQrPng(data.qrPng ?? null)
      } catch { /* keep state */ }
    }
    poll()
    const t = setInterval(poll, 2000)
    return () => { mounted = false; clearInterval(t) }
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #BFDBFE', boxShadow: '0 4px 24px rgba(30,58,95,0.08)', padding: '36px 40px', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#2563EB', color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.35)' }}>W</div>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1E3A5F', letterSpacing: '-0.02em' }}>Waly</span>
        </div>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>Conecta tu WhatsApp para activar el asistente</p>

        {qrPng ? (
          <>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #DBEAFE', padding: 12, display: 'inline-block', marginBottom: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrPng} alt="Código QR de WhatsApp" width={280} height={280} style={{ display: 'block', borderRadius: 6 }} />
            </div>
            <ol style={{ textAlign: 'left', fontSize: 13, color: '#334155', lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
              <li>Abre <strong>WhatsApp</strong> en el teléfono de la clínica</li>
              <li>Toca <strong>Ajustes → Dispositivos vinculados</strong></li>
              <li>Toca <strong>Vincular un dispositivo</strong> y escanea este código</li>
            </ol>
          </>
        ) : (
          <div style={{ padding: '40px 0', color: '#93C5FD' }}>
            <div style={{ width: 28, height: 28, margin: '0 auto 12px', border: '3px solid #DBEAFE', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#64748B' }}>
              {status === 'connecting' ? 'Conectando…' : 'Generando código QR…'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
