'use client'

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import { RefreshCw, Check, AlertTriangle, Sparkles, Settings2 } from 'lucide-react'

type Bloque =
  | { tipo: 'raw'; texto: string }
  | { tipo: 'seccion'; titulo: string; contenido: string; tecnica: boolean }

export default function ConfiguracionPage() {
  const [frontmatter, setFrontmatter] = useState('')
  const [bloques, setBloques] = useState<Bloque[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showTech, setShowTech] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch('/api/config').then(r => r.json())
      if (d.ok) { setFrontmatter(d.frontmatter); setBloques(d.bloques) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function updateSeccion(idx: number, contenido: string) {
    setBloques(prev => prev.map((b, i) => i === idx && b.tipo === 'seccion' ? { ...b, contenido } : b))
    setSaved(false)
  }

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const r = await fetch('/api/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontmatter, bloques }),
      })
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    } finally { setSaving(false) }
  }

  const negocio = bloques.map((b, i) => ({ b, i })).filter(x => x.b.tipo === 'seccion' && !(x.b as { tecnica: boolean }).tecnica)
  const tecnicas = bloques.map((b, i) => ({ b, i })).filter(x => x.b.tipo === 'seccion' && (x.b as { tecnica: boolean }).tecnica)

  if (loading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#FFFFFF' }}>
      <div className="flex items-center gap-2" style={{ color: '#A7D8CC' }}>
        <RefreshCw size={13} className="spin" /><span style={{ fontSize: 13 }}>Cargando...</span>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center shrink-0"
          style={{ height: 56, padding: '0 28px', background: '#fff', borderBottom: '1px solid #D3E7DE' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#054D44', letterSpacing: '-0.01em' }}>Entrenar IA</h1>
          <div className="flex-1" />
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5"
            style={{ height: 34, padding: '0 16px', borderRadius: 8, border: 'none',
              background: saved ? '#16A34A' : '#00A884', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
              boxShadow: '0 1px 3px rgba(37,99,235,0.3)' }}>
            {saving ? <><RefreshCw size={13} className="spin" /> Guardando…</>
              : saved ? <><Check size={14} /> Guardado</>
              : <><Check size={14} /> Guardar cambios</>}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '28px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Intro */}
            <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 12, background: '#E7F1EC', border: '1px solid #A7D8CC', marginBottom: 24 }}>
              <Sparkles size={18} style={{ color: '#00A884', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: '#054D44', lineHeight: 1.55 }}>
                Acá entrenas tu asistente: cambia precios, promociones, horarios y servicios.
                Los cambios se aplican al bot al instante, sin reiniciar nada.
              </p>
            </div>

            {/* Secciones de negocio */}
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Información del negocio
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              {negocio.map(({ b, i }) => b.tipo === 'seccion' && (
                <SeccionEditor key={i} titulo={b.titulo} contenido={b.contenido} onChange={v => updateSeccion(i, v)} />
              ))}
            </div>

            {/* Secciones técnicas (colapsable) */}
            {tecnicas.length > 0 && (
              <>
                <button onClick={() => setShowTech(s => !s)}
                  className="flex items-center gap-2"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, padding: 0, fontFamily: 'inherit' }}>
                  <Settings2 size={14} style={{ color: '#94A3B8' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Comportamiento avanzado {showTech ? '▾' : '▸'}
                  </span>
                </button>

                {showTech && (
                  <>
                    <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 16 }}>
                      <AlertTriangle size={15} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                        Estas secciones controlan cómo se comporta el bot (cuándo responder, cuándo callarse, cómo agendar). Edítalas solo si sabes lo que haces.
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                      {tecnicas.map(({ b, i }) => b.tipo === 'seccion' && (
                        <SeccionEditor key={i} titulo={b.titulo} contenido={b.contenido} onChange={v => updateSeccion(i, v)} tecnica />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SeccionEditor({ titulo, contenido, onChange, tecnica }: { titulo: string; contenido: string; onChange: (v: string) => void; tecnica?: boolean }) {
  const lines = Math.min(Math.max(contenido.split('\n').length + 1, 3), 16)
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${tecnica ? '#FDE68A' : '#D3E7DE'}`, overflow: 'hidden', boxShadow: '0 1px 2px rgba(30,58,95,0.04)' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F9F6', background: tecnica ? '#FFFBEB' : '#F3F9F6' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#054D44' }}>{titulo}</span>
      </div>
      <textarea
        value={contenido}
        onChange={e => onChange(e.target.value)}
        rows={lines}
        style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', padding: '12px 16px',
          fontSize: 13, lineHeight: 1.6, color: '#334155', fontFamily: 'inherit', background: '#fff' }}
      />
    </div>
  )
}
