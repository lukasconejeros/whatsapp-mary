'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import { ArrowLeft, Send } from 'lucide-react'

type Feedback = {
  id: number
  cliente_nombre: string | null
  cliente_telefono: string | null
  mensaje: string
  fotos: string[]
  sent_at: number | null
}

function fmtFecha(ts: number | null) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/feedbacks').then(r => r.json()).then(d => {
      if (d.ok) setFeedbacks(d.feedbacks)
    }).finally(() => setCargando(false))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="shrink-0 flex items-center" style={{ gap: 10, padding: '16px 20px', borderBottom: '1px solid #D3E7DE', background: '#FFFFFF' }}>
          <Link href="/asistente" title="Volver al Asistente"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, border: '1px solid #D3E7DE', color: '#008069' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#054D44', margin: 0 }}>Mensajes enviados</h1>
            <p style={{ fontSize: 12, color: '#667781', margin: '3px 0 0' }}>Las felicitaciones y mensajes que le mandaste a los apoderados.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '14px 20px', maxWidth: 720, width: '100%', margin: '0 auto' }}>
          {cargando && <p style={{ color: '#8696A0', fontSize: 13 }}>Cargando…</p>}
          {!cargando && feedbacks.length === 0 && (
            <div style={{ textAlign: 'center', color: '#8696A0', fontSize: 13, marginTop: 40 }}>
              <Send size={26} style={{ opacity: .4, marginBottom: 8 }} />
              <p>Todavía no has enviado mensajes.</p>
              <p style={{ fontSize: 12 }}>Desde el Asistente puedes pedir &ldquo;mándale un mensaje a la mamá de…&rdquo; y adjuntar fotos.</p>
            </div>
          )}
          <div className="flex flex-col" style={{ gap: 10 }}>
            {feedbacks.map(f => (
              <div key={f.id} style={{ padding: '13px 15px', borderRadius: 12, border: '1px solid #D3E7DE', background: '#fff' }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 7 }}>
                  <div className="flex items-center justify-center shrink-0"
                    style={{ width: 32, height: 32, borderRadius: '50%', background: '#E7F1EC', color: '#008069', fontWeight: 700, fontSize: 13 }}>
                    {(f.cliente_nombre ?? '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>{f.cliente_nombre ?? '(apoderado)'}</p>
                    {f.cliente_telefono && <p style={{ fontSize: 11, color: '#8696A0', margin: '2px 0 0' }}>+{f.cliente_telefono}</p>}
                  </div>
                  <span style={{ fontSize: 11, color: '#8696A0', flexShrink: 0 }}>{fmtFecha(f.sent_at)}</span>
                </div>
                {f.fotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {f.fotos.map((name, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={`/api/media/${name}`} alt="foto enviada"
                        style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 9, border: '1px solid #D3E7DE' }} />
                    ))}
                  </div>
                )}
                <p style={{ fontSize: 13, color: '#4B5563', margin: 0, whiteSpace: 'pre-wrap' }}>{f.mensaje}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
