'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AppNav from '@/components/AppNav'
import { Send, RotateCcw, ThumbsDown, Clock, Zap } from 'lucide-react'

type Msg = {
  id: number
  rol: 'apoderado' | 'bot'
  texto: string
  acciones?: string[]
  malo?: boolean
}

const SUGERENCIAS = [
  'Hola, quiero información',
  'vi su publicación, cuánto cuestan las clases?',
  'es para mi hijo de 6 años',
  'lo voy a pensar y te aviso',
]

export default function EnsayoPage() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [faltan, setFaltan] = useState(0)
  const [conEspera, setConEspera] = useState(true)
  const [error, setError] = useState('')
  const finRef = useRef<HTMLDivElement | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/ensayo')
      const d = await r.json()
      if (d.ok) {
        setMsgs(d.mensajes.map((m: { id: number; rol: 'apoderado' | 'bot'; texto: string; acciones: string | null; malo: number }) => ({
          id: m.id, rol: m.rol, texto: m.texto,
          acciones: m.acciones ? JSON.parse(m.acciones) : undefined,
          malo: m.malo === 1,
        })))
      }
    } catch { /* si falla, la pantalla queda vacía y se puede escribir igual */ }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando])

  async function enviar(t: string) {
    const limpio = t.trim()
    if (!limpio || pensando) return
    setTexto('')
    setError('')
    setMsgs(m => [...m, { id: -Date.now(), rol: 'apoderado', texto: limpio }])
    setPensando(true)

    try {
      const r = await fetch('/api/ensayo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: limpio }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error ?? 'no se pudo responder')

      // Con la espera puesta, se ve el mismo ritmo que tendría en WhatsApp.
      if (conEspera && d.demoraMs > 0) {
        const finMs = Date.now() + d.demoraMs
        await new Promise<void>(resolve => {
          const tick = setInterval(() => {
            const quedan = Math.max(0, Math.ceil((finMs - Date.now()) / 1000))
            setFaltan(quedan)
            if (quedan <= 0) { clearInterval(tick); resolve() }
          }, 250)
        })
        setFaltan(0)
      }

      setMsgs(m => [...m, { id: d.id, rol: 'bot', texto: d.texto, acciones: d.acciones }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'algo falló')
    } finally {
      setPensando(false)
      setFaltan(0)
    }
  }

  async function empezarDeNuevo() {
    if (!confirm('¿Borramos esta práctica y empezamos de nuevo?')) return
    await fetch('/api/ensayo', { method: 'DELETE' })
    setMsgs([])
    setError('')
  }

  async function marcarMalo(id: number, actual: boolean) {
    setMsgs(m => m.map(x => x.id === id ? { ...x, malo: !actual } : x))
    await fetch('/api/ensayo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, malo: !actual }),
    })
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="shrink-0" style={{ padding: '14px 18px', borderBottom: '1px solid #D3E7DE', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#054D44', margin: 0 }}>Practicar con el bot</h1>
              <p style={{ fontSize: 12, color: '#667781', margin: '4px 0 0' }}>
                Escribe como si fueras un apoderado que recién llega, y mira cómo contesta.
              </p>
            </div>
            <button onClick={empezarDeNuevo} title="Borrar esta práctica"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#008069', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <RotateCcw size={14} /> Empezar de nuevo
            </button>
          </div>

          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: '#8A6D3B', background: '#FFF8E5', border: '1px solid #F3E2B3', borderRadius: 8, padding: '6px 10px' }}>
              Esto es solo una práctica. A los apoderados de verdad les sigues contestando tú.
            </div>
            <button onClick={() => setConEspera(v => !v)}
              title={conEspera ? 'Se toma unos segundos, como una persona (en WhatsApp de verdad espera más)' : 'Ahora contesta al tiro'}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid #D3E7DE', background: conEspera ? '#F3F9F6' : '#fff', color: '#008069', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {conEspera ? <><Clock size={13} /> Se demora unos segundos</> : <><Zap size={13} /> Contesta al tiro</>}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720, width: '100%', margin: '0 auto' }}>
          {msgs.length === 0 && !pensando && (
            <>
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#fff', color: '#374151', border: '1px solid #D3E7DE', borderRadius: 14, padding: '10px 13px', fontSize: 13 }}>
                Hola Mary 🎨 Acá puedes hacerte pasar por una mamá que pregunta por las clases y ver
                cómo respondería el bot. Nadie más ve esto. Prueba con lo de siempre:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SUGERENCIAS.map(s => (
                  <button key={s} onClick={() => enviar(s)}
                    style={{ padding: '7px 11px', borderRadius: 999, border: '1px solid #D3E7DE', background: '#F3F9F6', color: '#008069', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {msgs.map(m => (
            <div key={m.id} style={{ alignSelf: m.rol === 'apoderado' ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 5, alignItems: m.rol === 'apoderado' ? 'flex-end' : 'flex-start' }}>
              {m.texto ? (
                <div style={{ background: m.rol === 'apoderado' ? '#00A884' : '#fff', color: m.rol === 'apoderado' ? '#fff' : '#374151', border: m.rol === 'apoderado' ? 'none' : '1px solid #D3E7DE', borderRadius: 14, padding: '10px 13px', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {m.texto}
                </div>
              ) : m.rol === 'bot' && (
                <div style={{ fontSize: 12, color: '#8696A0', fontStyle: 'italic' }}>Acá no habría contestado nada.</div>
              )}

              {m.acciones?.map((a, i) => (
                <div key={i} style={{ fontSize: 11, color: '#5C7A6E', background: '#F3F9F6', border: '1px dashed #C7E0D5', borderRadius: 9, padding: '5px 9px' }}>
                  {a}
                </div>
              ))}

              {m.rol === 'bot' && m.id > 0 && (
                <button onClick={() => marcarMalo(m.id, !!m.malo)}
                  title="Marca las respuestas que no suenan a ti, para irlas corrigiendo"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, border: '1px solid ' + (m.malo ? '#E5A0A0' : '#E5E7EB'), background: m.malo ? '#FDECEC' : '#fff', color: m.malo ? '#B03A3A' : '#9CA3AF', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <ThumbsDown size={11} /> {m.malo ? 'Marcaste que no lo dirías' : 'Esto yo no lo diría'}
                </button>
              )}
            </div>
          ))}

          {pensando && (
            <div style={{ alignSelf: 'flex-start', color: '#8696A0', fontSize: 12, fontStyle: 'italic' }}>
              {faltan > 0 ? `escribiendo… (contestaría en ${faltan} s)` : 'escribiendo…'}
            </div>
          )}
          {error && (
            <div style={{ alignSelf: 'center', color: '#B03A3A', background: '#FDECEC', border: '1px solid #E5A0A0', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
              No pude responder: {error}
            </div>
          )}
          <div ref={finRef} />
        </div>

        <form onSubmit={e => { e.preventDefault(); enviar(texto) }}
          style={{ maxWidth: 720, width: '100%', margin: '0 auto', display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #D3E7DE', background: '#FFFFFF', alignItems: 'center', flexShrink: 0 }}>
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escribe como si fueras un apoderado…"
            style={{ flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 12, border: '1px solid #D3E7DE', fontSize: 15, outline: 'none', fontFamily: 'inherit', background: '#F7FAF9' }}
          />
          <button type="submit" disabled={!texto.trim() || pensando}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 12, border: 'none', cursor: texto.trim() && !pensando ? 'pointer' : 'default', background: texto.trim() && !pensando ? '#00A884' : '#D3E7DE', color: '#fff', flexShrink: 0 }}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
