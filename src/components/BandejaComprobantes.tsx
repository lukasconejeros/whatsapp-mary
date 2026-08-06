'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, X, Image as ImageIcon } from 'lucide-react'
import { INGRESO_TIPOS, formatCLP } from '@/lib/finanzas'

// Bandeja de comprobantes: las fotos de transferencia que llegaron al WhatsApp y que
// NO entran solas a Ingresos. Mary mira la foto, corrige si hace falta y aprueba de un
// toque. Decisión de Lukas (05-08-2026): nada automático.

type Pendiente = {
  id: number
  media: string | null
  monto: number
  fecha: string
  nombre: string | null
  banco: string | null
  esperado: number
  de_meta: number
  contacto: string | null
  telefono: string
}

export default function BandejaComprobantes({ onCambio }: { onCambio: () => void }) {
  const [items, setItems] = useState<Pendiente[]>([])
  const [edits, setEdits] = useState<Record<number, { monto: string; tipo: string }>>({})
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [foto, setFoto] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await fetch('/api/comprobantes').then(r => r.json())
      if (d.ok) setItems(d.comprobantes)
    } catch { /* si no hay internet, la bandeja simplemente no aparece */ }
  }, [])
  useEffect(() => { load() }, [load])

  const campo = (c: Pendiente) => edits[c.id] ?? { monto: String(c.monto), tipo: '' }

  async function accion(c: Pendiente, accion: 'aprobar' | 'descartar') {
    if (ocupado !== null) return // evita el doble toque
    if (accion === 'descartar' && !confirm('¿Descartar este comprobante? No se registra ningún ingreso.')) return
    const e = campo(c)
    const monto = parseInt(e.monto.replace(/\D/g, ''), 10)
    if (accion === 'aprobar' && !monto) { alert('Escribe el monto antes de aprobar.'); return }
    setOcupado(c.id)
    try {
      const r = await fetch(`/api/comprobantes/${c.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accion === 'aprobar'
          ? { accion, monto, tipo: e.tipo || undefined, detalle: c.nombre || c.contacto || undefined }
          : { accion }),
      }).then(x => x.json())
      if (r.ok) { setItems(p => p.filter(x => x.id !== c.id)); onCambio() }
      else alert(r.error || 'No se pudo. Reintenta.')
    } catch { alert('No se pudo. Revisa tu internet.') }
    finally { setOcupado(null) }
  }

  if (items.length === 0) return null

  return (
    <div style={{ marginBottom: 18, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '14px 16px' }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#92400E', marginBottom: 2 }}>
        Comprobantes por revisar ({items.length})
      </p>
      <p style={{ fontSize: 12, color: '#A16207', marginBottom: 12 }}>
        Llegaron por WhatsApp. Mira la foto, corrige el monto si está mal y aprueba: recién ahí se suma a Ingresos.
      </p>

      <div className="flex" style={{ flexDirection: 'column', gap: 10 }}>
        {items.map(c => {
          const e = campo(c)
          const trabajando = ocupado === c.id
          return (
            <div key={c.id} className="flex items-center" style={{ gap: 12, background: '#fff', border: '1px solid #FDE68A', borderRadius: 12, padding: 10, flexWrap: 'wrap' }}>
              {/* Foto del comprobante */}
              {c.media ? (
                <button onClick={() => setFoto(c.media)} title="Ver la foto completa"
                  style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'zoom-in', lineHeight: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/media/${c.media}`} alt="Comprobante"
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 9, border: '1px solid #FDE68A' }} />
                </button>
              ) : (
                <div className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 9, background: '#FEF3C7', color: '#D97706' }}>
                  <ImageIcon size={18} />
                </div>
              )}

              {/* De quién es */}
              <div style={{ minWidth: 130, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#054D44' }}>{c.nombre || c.contacto || c.telefono}</p>
                <p style={{ fontSize: 11, color: '#8696A0' }}>
                  {c.fecha}{c.banco ? ` · ${c.banco}` : ''}
                  {c.de_meta ? ' · vino de Meta' : ''}
                  {c.esperado ? '' : ' · monto poco habitual'}
                </p>
              </div>

              {/* Monto (editable) y categoría */}
              <div className="flex items-center" style={{ gap: 6 }}>
                <span style={{ fontSize: 11, color: '#8696A0' }}>{formatCLP(c.monto)} →</span>
                <input inputMode="numeric" value={e.monto}
                  onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, monto: ev.target.value } }))}
                  style={{ width: 96, padding: '6px 8px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#054D44' }} />
              </div>
              <select value={e.tipo} onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, tipo: ev.target.value } }))}
                style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 12, background: '#fff', color: '#054D44', maxWidth: 170 }}>
                <option value="">— categoría —</option>
                {INGRESO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              {/* Los dos botones */}
              <div className="flex items-center" style={{ gap: 6, marginLeft: 'auto' }}>
                <button onClick={() => accion(c, 'aprobar')} disabled={trabajando} className="flex items-center gap-1"
                  style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: '#00A884', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: trabajando ? 'default' : 'pointer', opacity: trabajando ? 0.6 : 1 }}>
                  <Check size={14} /> Aprobar
                </button>
                <button onClick={() => accion(c, 'descartar')} disabled={trabajando} title="Descartar"
                  style={{ display: 'flex', padding: '7px 9px', borderRadius: 9, border: '1px solid #D3E7DE', background: '#fff', color: '#8696A0', cursor: trabajando ? 'default' : 'pointer', opacity: trabajando ? 0.6 : 1 }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* La foto en grande */}
      {foto && (
        <div onClick={() => setFoto(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,77,68,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/${foto}`} alt="Comprobante"
            style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }} />
        </div>
      )}
    </div>
  )
}
