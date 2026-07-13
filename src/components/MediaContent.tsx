'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, X } from 'lucide-react'

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60), ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

// Reproductor de nota de voz, compacto (botón + barra + tiempo). Acento rosita.
export function AudioNote({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)

  function toggle() {
    const a = ref.current
    if (!a) return
    // play() devuelve promesa; si el códec no está soportado (ej. ogg/opus en iOS)
    // o el navegador la bloquea, NO dejar la UI mostrando "pausar" como si sonara.
    if (a.paused) { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)) }
    else { a.pause(); setPlaying(false) }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current
    if (!a || !isFinite(dur) || dur <= 0) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - r.left) / r.width) * dur
  }
  const pct = isFinite(dur) && dur > 0 ? (cur / dur) * 100 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, padding: '2px 0' }}>
      <button onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}
        style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#00A884', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {playing ? <Pause size={19} /> : <Play size={19} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1 }}>
        <div onClick={seek} style={{ height: 7, background: '#CBD5E1', borderRadius: 4, cursor: 'pointer', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: '#00A884', borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{fmt(cur)} / {fmt(dur)}</div>
      </div>
      <audio ref={ref} src={src} preload="metadata"
        onLoadedMetadata={e => setDur((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={e => setCur((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => { setPlaying(false); setCur(0) }} />
    </div>
  )
}

// Miniatura de imagen: al tocarla abre un VISOR PROPIO a pantalla completa con botón
// de cerrar grande. Antes hacía window.open, que en la app instalada (PWA sin barra
// del navegador) dejaba la foto abierta SIN forma de volver.
export function ImageNote({ src }: { src: string }) {
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    if (!abierta) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden' // no scrollear el chat detrás del visor
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [abierta])

  return (
    <>
      <img src={src} alt="foto" onClick={() => setAbierta(true)}
        style={{ display: 'block', maxWidth: 220, maxHeight: 260, borderRadius: 8, cursor: 'zoom-in' }} />
      {abierta && (
        <div onClick={() => setAbierta(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <button onClick={(e) => { e.stopPropagation(); setAbierta(false) }} aria-label="Cerrar"
            style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 14, width: 48, height: 48, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <X size={26} />
          </button>
          <img src={src} alt="foto" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '96%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </>
  )
}

// Reproductor de video, con controles nativos y tamaño acotado.
export function VideoNote({ src }: { src: string }) {
  return (
    <video src={src} controls preload="metadata"
      style={{ display: 'block', maxWidth: 240, maxHeight: 300, borderRadius: 8, background: '#000' }} />
  )
}
