'use client'

import { useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'

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
    if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current
    if (!a || !isFinite(dur) || dur <= 0) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - r.left) / r.width) * dur
  }
  const pct = isFinite(dur) && dur > 0 ? (cur / dur) * 100 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 190, padding: '2px 0' }}>
      <button onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}
        style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#EC4899', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {playing ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1 }}>
        <div onClick={seek} style={{ height: 4, background: '#CBD5E1', borderRadius: 2, cursor: 'pointer', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: '#EC4899', borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{fmt(cur)} / {fmt(dur)}</div>
      </div>
      <audio ref={ref} src={src} preload="metadata"
        onLoadedMetadata={e => setDur((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={e => setCur((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => { setPlaying(false); setCur(0) }} />
    </div>
  )
}

// Miniatura de imagen: tamaño acotado, esquinas redondeadas, clic para abrir grande.
export function ImageNote({ src }: { src: string }) {
  return (
    <img src={src} alt="foto" onClick={() => window.open(src, '_blank')}
      style={{ display: 'block', maxWidth: 220, maxHeight: 260, borderRadius: 8, cursor: 'zoom-in' }} />
  )
}

// Reproductor de video, con controles nativos y tamaño acotado.
export function VideoNote({ src }: { src: string }) {
  return (
    <video src={src} controls preload="metadata"
      style={{ display: 'block', maxWidth: 240, maxHeight: 300, borderRadius: 8, background: '#000' }} />
  )
}
