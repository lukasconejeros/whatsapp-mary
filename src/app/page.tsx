'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Brush } from 'lucide-react'

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

  // Solo mostramos el QR/instrucciones si REALMENTE falta vincular WhatsApp. Mientras
  // aún consultamos el estado (o ya está conectado y estamos por redirigir a los chats),
  // mostramos un cargando NEUTRO — nunca el texto de "Generando QR" (era el bug: al abrir
  // la app parpadeaba la pantalla de QR aunque estuviera todo conectado).
  const necesitaVincular = status === 'qr' || status === 'disconnected'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #FAD1E5', boxShadow: '0 4px 24px rgba(30,58,95,0.08)', padding: '36px 40px', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: necesitaVincular ? 6 : 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', border: '1px solid #FAD1E5', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(236,72,153,0.25)' }}>
            <Brush size={19} strokeWidth={2.2} style={{ color: '#EC4899' }} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#9D174D', letterSpacing: '-0.02em' }}>Arteluk</span>
        </div>

        {necesitaVincular ? (
          <>
            <p style={{ fontSize: 13, color: '#B0708C', margin: '6px 0 24px' }}>Conecta el WhatsApp de Arteluk para empezar</p>
            {qrPng ? (
              <>
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #FDE7F1', padding: 12, display: 'inline-block', marginBottom: 20 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrPng} alt="Código QR de WhatsApp" width={280} height={280} style={{ display: 'block', borderRadius: 6 }} />
                </div>
                <ol style={{ textAlign: 'left', fontSize: 13, color: '#334155', lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
                  <li>Abre <strong>WhatsApp</strong> en el teléfono de Mary</li>
                  <li>Toca <strong>Ajustes → Dispositivos vinculados</strong></li>
                  <li>Toca <strong>Vincular un dispositivo</strong> y escanea este código</li>
                </ol>
              </>
            ) : (
              <div style={{ padding: '30px 0' }}>
                <div style={{ width: 28, height: 28, margin: '0 auto 12px', border: '3px solid #FDE7F1', borderTopColor: '#EC4899', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <p style={{ fontSize: 13, color: '#64748B' }}>Generando código QR…</p>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '28px 0 6px' }}>
            <div style={{ width: 26, height: 26, margin: '0 auto 12px', border: '3px solid #FDE7F1', borderTopColor: '#EC4899', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <p style={{ fontSize: 13, color: '#64748B' }}>Cargando…</p>
          </div>
        )}
      </div>
    </div>
  )
}
