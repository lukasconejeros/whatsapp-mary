'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AppNav from '@/components/AppNav'
import { Send, Mic, Square } from 'lucide-react'

type Msg = { id: number; rol: 'user' | 'asistente'; texto: string }

export default function AsistentePage() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const finRef = useRef<HTMLDivElement | null>(null)

  const cargar = useCallback(async () => {
    const d = await fetch('/api/asistente').then(r => r.json())
    if (d.ok) setMsgs(d.mensajes)
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando])

  async function enviar(t: string, origen: 'texto' | 'audio' = 'texto') {
    const limpio = t.trim()
    if (!limpio || pensando) return
    setTexto('')
    setMsgs(m => [...m, { id: Date.now(), rol: 'user', texto: limpio }])
    setPensando(true)
    try {
      const d = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: limpio, origen }),
      }).then(r => r.json())
      setMsgs(m => [...m, { id: Date.now() + 1, rol: 'asistente', texto: d.respuesta ?? 'No pude responder.' }])
    } catch {
      setMsgs(m => [...m, { id: Date.now() + 1, rol: 'asistente', texto: 'No pude conectar. Revisa tu internet e intenta de nuevo.' }])
    } finally {
      setPensando(false)
    }
  }

  async function toggleMic() {
    if (grabando) {
      recRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setGrabando(false)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const form = new FormData()
        form.append('file', blob, 'audio.webm')
        setPensando(true)
        try {
          const d = await fetch('/api/asistente/transcribir', { method: 'POST', body: form }).then(r => r.json())
          if (d.ok && d.texto) {
            await enviar(d.texto, 'audio')
          } else {
            setMsgs(m => [...m, { id: Date.now(), rol: 'asistente', texto: 'No te escuché bien, ¿lo intentas de nuevo?' }])
          }
        } finally {
          setPensando(false)
        }
      }
      rec.start()
      recRef.current = rec
      setGrabando(true)
    } catch {
      setGrabando(false)
      setMsgs(m => [...m, { id: Date.now(), rol: 'asistente', texto: 'No pude usar el micrófono. Revisa el permiso del navegador e intenta de nuevo.' }])
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FDF2F8' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="shrink-0" style={{ padding: '18px 20px', borderBottom: '1px solid #FBCFE8', background: '#FFFFFF' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#831843', margin: 0 }}>Asistente</h1>
          <p style={{ fontSize: 12, color: '#9D5577', margin: '4px 0 0' }}>Cuéntame tus gastos e ingresos o pregúntame por la plata y el calendario.</p>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720, width: '100%', margin: '0 auto' }}>
          {msgs.map(m => (
            <div key={m.id} style={{ alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', background: m.rol === 'user' ? '#EC4899' : '#fff', color: m.rol === 'user' ? '#fff' : '#374151', border: m.rol === 'user' ? 'none' : '1px solid #FBCFE8', borderRadius: 14, padding: '9px 13px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {m.texto}
            </div>
          ))}
          {pensando && <div style={{ alignSelf: 'flex-start', color: '#B57795', fontSize: 12, fontStyle: 'italic' }}>escribiendo…</div>}
          <div ref={finRef} />
        </div>

        <form onSubmit={e => { e.preventDefault(); enviar(texto) }} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #FBCFE8', background: '#FFFFFF', maxWidth: 720, width: '100%', margin: '0 auto', flexShrink: 0 }}>
          <button type="button" onClick={toggleMic} title={grabando ? 'Detener' : 'Grabar audio'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: grabando ? '#DC2626' : '#FBCFE8', color: grabando ? '#fff' : '#831843' }}>
            {grabando ? <Square size={18} /> : <Mic size={18} />}
          </button>
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe aquí…" style={{ flex: 1, borderRadius: 12, border: '1px solid #FBCFE8', padding: '0 14px', fontSize: 13, outline: 'none' }} />
          <button type="submit" disabled={pensando || !texto.trim()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#EC4899', color: '#fff', opacity: pensando || !texto.trim() ? 0.5 : 1 }}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
