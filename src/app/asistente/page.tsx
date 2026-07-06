'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import { Send, Mic, Square, History, ImagePlus, X, MailCheck } from 'lucide-react'

type Msg = { id: number; rol: 'user' | 'asistente'; texto: string; fotos?: string[] }
type FotoAdjunta = { name: string; url: string; subiendo?: boolean }

// Reconocimiento de voz nativo del navegador/teléfono (Web Speech API). No necesita
// ninguna clave ni servicio pago: usa el motor de dictado del propio dispositivo.
type SRResult = { transcript: string }
type SRResultList = ArrayLike<ArrayLike<SRResult> & { isFinal: boolean }>
type SREvent = { resultIndex: number; results: SRResultList }
interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: SREvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}
function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function AsistentePage() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [fotos, setFotos] = useState<FotoAdjunta[]>([])
  const recRef = useRef<MediaRecorder | null>(null)
  const srRef = useRef<SpeechRec | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const finRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // El chat arranca LIMPIO cada vez que entras (solo el saludo). El historial
  // completo se carga a demanda con el botón "Ver historial".
  const [historialVisto, setHistorialVisto] = useState(false)
  const cargarHistorial = useCallback(async () => {
    const d = await fetch('/api/asistente').then(r => r.json())
    if (d.ok) { setMsgs(d.mensajes); setHistorialVisto(true) }
  }, [])
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando, fotos])

  // Al salir del Asistente, cortar dictado/grabación para no dejar el micrófono abierto.
  useEffect(() => () => {
    try { srRef.current?.stop() } catch { /* noop */ }
    try { recRef.current?.stop() } catch { /* noop */ }
  }, [])

  async function subirFotos(files: FileList | null) {
    if (!files || files.length === 0) return
    const nuevas = Array.from(files).slice(0, 5)
    for (const file of nuevas) {
      const url = URL.createObjectURL(file)
      const tmp: FotoAdjunta = { name: '', url, subiendo: true }
      setFotos(f => [...f, tmp])
      try {
        const form = new FormData()
        form.append('file', file)
        const d = await fetch('/api/asistente/foto', { method: 'POST', body: form }).then(r => r.json())
        setFotos(f => f.map(x => x.url === url ? { name: d.ok ? d.name : '', url, subiendo: false } : x))
      } catch {
        setFotos(f => f.map(x => x.url === url ? { ...x, subiendo: false } : x))
      }
    }
  }

  function quitarFoto(url: string) {
    try { URL.revokeObjectURL(url) } catch { /* noop */ }
    setFotos(f => f.filter(x => x.url !== url))
  }

  async function enviar(t: string, origen: 'texto' | 'audio' = 'texto') {
    const limpio = t.trim()
    const adjuntas = fotos.filter(f => f.name)
    if ((!limpio && adjuntas.length === 0) || pensando) return
    setTexto('')
    const fotosUrls = fotos.map(f => f.url)
    setFotos([])
    setMsgs(m => [...m, { id: Date.now(), rol: 'user', texto: limpio, fotos: fotosUrls.length ? fotosUrls : undefined }])
    setPensando(true)
    try {
      const d = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: limpio, origen, fotos: adjuntas.map(f => f.name) }),
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
      srRef.current?.stop()
      recRef.current?.stop()
      return
    }

    // 1) Dictado NATIVO del teléfono (sin token, gratis). Es lo que usa el teclado
    //    de voz. Va escribiendo en el cuadro de texto y al terminar lo envía.
    const SR = getSpeechRecognition()
    if (SR) {
      try {
        const rec = new SR()
        rec.lang = 'es-CL'
        rec.interimResults = true
        rec.continuous = false
        let finalText = ''
        rec.onresult = (e: SREvent) => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]
            const t = r[0].transcript
            if (r.isFinal) finalText += t
            else interim += t
          }
          setTexto((finalText + interim).trim())
        }
        rec.onerror = () => { setGrabando(false) }
        rec.onend = () => {
          setGrabando(false)
          const t = finalText.trim()
          setTexto('')
          if (t) enviar(t, 'audio')
        }
        rec.start()
        srRef.current = rec
        setGrabando(true)
        return
      } catch {
        setGrabando(false)
      }
    }

    // 2) Respaldo (navegadores sin dictado nativo): graba y transcribe en el servidor
    //    (esto sí necesita GROQ_API_KEY/OPENAI_API_KEY en el entorno).
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

  const puedeEnviar = (texto.trim().length > 0 || fotos.some(f => f.name)) && !fotos.some(f => f.subiendo)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="shrink-0 flex items-center" style={{ gap: 12, padding: '16px 20px', borderBottom: '1px solid #FAD1E5', background: '#FFFFFF' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#9D174D', margin: 0 }}>Asistente</h1>
            <p style={{ fontSize: 12, color: '#B0708C', margin: '4px 0 0' }}>Cuéntame gastos e ingresos, pregúntame por la plata y el calendario, o pídeme mandarle un mensaje con fotos a un apoderado.</p>
          </div>
          <Link href="/feedbacks" title="Ver los mensajes que enviaste"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: '1px solid #FAD1E5', background: '#FFF4FA', color: '#BE185D', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <MailCheck size={14} /> Enviados
          </Link>
          {!historialVisto && (
            <button onClick={cargarHistorial} title="Ver el historial completo"
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: '1px solid #FAD1E5', background: '#FFF4FA', color: '#BE185D', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <History size={14} /> Ver historial
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720, width: '100%', margin: '0 auto' }}>
          {msgs.length === 0 && !pensando && (
            <div style={{ alignSelf: 'flex-start', maxWidth: '80%', background: '#fff', color: '#374151', border: '1px solid #FAD1E5', borderRadius: 14, padding: '9px 13px', fontSize: 13 }}>
              ¡Hola Mary! 🎨 Cuéntame un gasto o ingreso, pregúntame por la plata y el calendario, o dime algo como <em>&ldquo;mándale un mensaje a la mamá de Amparo&rdquo;</em> y adjunta las fotos con 🖼️.
            </div>
          )}
          {msgs.map(m => (
            <div key={m.id} style={{ alignSelf: m.rol === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.rol === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.fotos && m.fotos.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {m.fotos.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={u} alt="foto" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid #FAD1E5' }} />
                  ))}
                </div>
              )}
              {m.texto && (
                <div style={{ background: m.rol === 'user' ? '#EC4899' : '#fff', color: m.rol === 'user' ? '#fff' : '#374151', border: m.rol === 'user' ? 'none' : '1px solid #FAD1E5', borderRadius: 14, padding: '9px 13px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {m.texto}
                </div>
              )}
            </div>
          ))}
          {pensando && <div style={{ alignSelf: 'flex-start', color: '#C0879F', fontSize: 12, fontStyle: 'italic' }}>escribiendo…</div>}
          <div ref={finRef} />
        </div>

        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', flexShrink: 0 }}>
          {/* Previews de fotos adjuntas */}
          {fotos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 16px 0' }}>
              {fotos.map(f => (
                <div key={f.url} style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="adjunta" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10, border: '1px solid #FAD1E5', opacity: f.subiendo ? 0.5 : 1 }} />
                  {f.subiendo && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#BE185D' }}>subiendo…</div>}
                  <button onClick={() => quitarFoto(f.url)} title="Quitar"
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#BE185D', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={e => { e.preventDefault(); enviar(texto) }} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #FAD1E5', background: '#FFFFFF', alignItems: 'center' }}>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { subirFotos(e.target.files); e.target.value = '' }} />
            <button type="button" onClick={() => fileRef.current?.click()} title="Adjuntar fotos"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#FAD1E5', color: '#9D174D' }}>
              <ImagePlus size={18} />
            </button>
            <button type="button" onClick={toggleMic} title={grabando ? 'Detener' : 'Grabar audio'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: grabando ? '#DC2626' : '#FAD1E5', color: grabando ? '#fff' : '#9D174D' }}>
              {grabando ? <Square size={18} /> : <Mic size={18} />}
            </button>
            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe aquí…" style={{ flex: 1, borderRadius: 12, border: '1px solid #FAD1E5', padding: '0 14px', height: 42, fontSize: 13, outline: 'none' }} />
            <button type="submit" disabled={pensando || !puedeEnviar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', background: '#EC4899', color: '#fff', opacity: pensando || !puedeEnviar ? 0.5 : 1 }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
