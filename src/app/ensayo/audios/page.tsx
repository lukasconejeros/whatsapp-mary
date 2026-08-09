'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AppNav from '@/components/AppNav'
import { Mic, Trash2, ArrowLeft, Square } from 'lucide-react'

type Audio = {
  id: number
  archivo: string
  titulo: string
  cuando_usarlo: string
  segundos: number
}

export default function AudiosMaryPage() {
  const [audios, setAudios] = useState<Audio[]>([])
  const [titulo, setTitulo] = useState('')
  const [cuando, setCuando] = useState('')
  const [grabando, setGrabando] = useState(false)
  const [segGrab, setSegGrab] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const inicioRef = useRef(0)
  const cronoRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // El título y el "cuándo usarlo" se leen al PARAR de grabar, no al empezar:
  // sin esto, el onstop se queda con el texto viejo de cuando arrancó la grabación.
  const datosRef = useRef({ titulo: '', cuando: '' })

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/audios-mary')
      const d = await r.json()
      if (d.ok) setAudios(d.audios)
    } catch { /* si falla, la lista queda vacía */ }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Si se cierra la pantalla grabando, se suelta el micrófono.
  useEffect(() => () => {
    if (cronoRef.current) clearInterval(cronoRef.current)
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }, [])

  useEffect(() => { datosRef.current = { titulo, cuando } }, [titulo, cuando])

  async function grabar() {
    if (grabando) { recRef.current?.stop(); return }
    setError('')
    if (!titulo.trim()) { setError('Primero ponle un nombre, para que después sepas cuál es.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      inicioRef.current = Date.now()
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (cronoRef.current) { clearInterval(cronoRef.current); cronoRef.current = null }
        const segundos = Math.max(1, Math.round((Date.now() - inicioRef.current) / 1000))
        const fd = new FormData()
        fd.append('file', new Blob(chunksRef.current, { type: mime }), 'audio')
        fd.append('titulo', datosRef.current.titulo)
        fd.append('cuando_usarlo', datosRef.current.cuando)
        fd.append('segundos', String(segundos))
        setGuardando(true)
        try {
          const r = await fetch('/api/audios-mary', { method: 'POST', body: fd })
          const d = await r.json()
          if (d.ok) { setTitulo(''); setCuando(''); await cargar() }
          else setError(d.error ?? 'No pude guardar el audio')
        } catch {
          setError('No pude guardar el audio')
        } finally {
          setGuardando(false)
          setGrabando(false)
          setSegGrab(0)
        }
      }
      recRef.current = rec
      rec.start()
      setGrabando(true)
      setSegGrab(0)
      cronoRef.current = setInterval(() => setSegGrab(s => s + 1), 1000)
    } catch {
      setError('No pude usar el micrófono. Dale permiso al navegador.')
      setGrabando(false)
    }
  }

  async function guardarCampo(id: number, campos: { titulo?: string; cuando_usarlo?: string }) {
    await fetch('/api/audios-mary', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...campos }),
    })
  }

  async function sacar(id: number) {
    if (!confirm('¿Sacamos este audio de la lista? La grabación no se borra.')) return
    await fetch(`/api/audios-mary?id=${id}`, { method: 'DELETE' })
    setAudios(a => a.filter(x => x.id !== id))
  }

  const caja = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid #D3E7DE', fontSize: 15, fontFamily: 'inherit', outline: 'none', background: '#F7FAF9' } as const

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="shrink-0" style={{ padding: '14px 18px', borderBottom: '1px solid #D3E7DE', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#054D44', margin: 0 }}>Mis audios</h1>
              <p style={{ fontSize: 12, color: '#667781', margin: '4px 0 0' }}>
                Graba con tu voz las respuestas que te cuesta escribir. El bot te va a proponer mandarlas; tú decides.
              </p>
            </div>
            <a href="/ensayo"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#008069', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Volver a practicar
            </a>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 18px', maxWidth: 720, width: '100%', margin: '0 auto' }}>
          <div style={{ border: '1px solid #D3E7DE', borderRadius: 14, padding: 14, background: '#F7FAF9', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#054D44' }}>¿Cómo le llamas?</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="el del autismo" style={caja} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#054D44' }}>¿Cuándo hay que mandarlo?</label>
              {/* Caja de dos líneas: en el teléfono una sola línea le corta la frase y no puede releer lo que escribió. */}
              <textarea value={cuando} onChange={e => setCuando(e.target.value)} rows={2}
                placeholder="cuando preguntan por niños con autismo" style={{ ...caja, resize: 'vertical' }} />
            </div>
            <button onClick={grabar} disabled={guardando}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 16px', borderRadius: 12, border: 'none', background: grabando ? '#B03A3A' : '#00A884', color: '#fff', fontSize: 15, fontWeight: 700, cursor: guardando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {grabando ? <><Square size={15} /> Listo, guardar ({segGrab} s)</> : <><Mic size={16} /> {guardando ? 'Guardando…' : 'Grabar'}</>}
            </button>
            {error && (
              <div style={{ color: '#B03A3A', background: '#FDECEC', border: '1px solid #E5A0A0', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>{error}</div>
            )}
          </div>

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {audios.length === 0 && (
              <p style={{ fontSize: 13, color: '#667781' }}>
                Todavía no tienes ninguno. Graba el primero con lo que más te preguntan.
              </p>
            )}
            {audios.map(a => (
              <div key={a.id} style={{ border: '1px solid #D3E7DE', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input defaultValue={a.titulo} onBlur={e => guardarCampo(a.id, { titulo: e.target.value })}
                    style={{ ...caja, flex: 1, fontWeight: 700, color: '#054D44', background: '#fff' }} />
                  <button onClick={() => sacar(a.id)} title="Sacar de la lista"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, border: '1px solid #E5A0A0', background: '#FDECEC', color: '#B03A3A', cursor: 'pointer', flexShrink: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea defaultValue={a.cuando_usarlo} placeholder="¿Cuándo hay que mandarlo?" rows={2}
                  onBlur={e => guardarCampo(a.id, { cuando_usarlo: e.target.value })}
                  style={{ ...caja, background: '#fff', resize: 'vertical' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <audio controls src={`/api/media/${a.archivo}`} style={{ height: 36, maxWidth: 280, width: '100%' }} />
                  <span style={{ fontSize: 11, color: '#8696A0' }}>{a.segundos} s</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
