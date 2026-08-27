'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, X, Image as ImageIcon } from 'lucide-react'
import { INGRESO_TIPOS, formatCLP } from '@/lib/finanzas'

// Bandeja de comprobantes: las fotos de transferencia que llegaron al WhatsApp y que
// NO entran solas a Ingresos. Mary mira la foto, corrige si hace falta y aprueba de un
// toque. Decisión de Lukas (05-08-2026): nada automático.

// Un alumno posible para este pago. 'alumnoIds' trae más de uno cuando la
// transferencia paga a los hermanos de una vez.
type Candidato = { alumnoIds: number[]; etiqueta: string; razon: string; avisos: string[] }
type Propuesta = { mes: string | null; candidatos: Candidato[]; elegido: Candidato | null } | null
type AlumnoLista = { id: number; nombre: string; mensualidad: number }

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
  propuesta: Propuesta
}

export default function BandejaComprobantes({ onCambio }: { onCambio: () => void }) {
  const [items, setItems] = useState<Pendiente[]>([])
  const [alumnos, setAlumnos] = useState<AlumnoLista[]>([])
  const [edits, setEdits] = useState<Record<number, { monto: string; tipo: string; quien: string; mes: string }>>({})
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [foto, setFoto] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await fetch('/api/comprobantes').then(r => r.json())
      if (d.ok) { setItems(d.comprobantes); setAlumnos(d.alumnos ?? []) }
    } catch { /* si no hay internet, la bandeja simplemente no aparece */ }
  }, [])
  useEffect(() => { load() }, [load])

  const campo = (c: Pendiente) => edits[c.id] ?? {
    monto: String(c.monto),
    tipo: '',
    // Viene preseleccionado el que propone la app, para que sea UN toque. Vacío
    // cuando hay dudas: ahí elige Mary, que es la regla desde el primer día.
    quien: c.propuesta?.elegido?.alumnoIds.join(',') ?? '',
    mes: c.propuesta?.mes ?? '',
  }

  /** El candidato que está elegido ahora mismo en el desplegable, para su explicación. */
  const candidatoDe = (c: Pendiente, quien: string): Candidato | null =>
    c.propuesta?.candidatos.find(x => x.alumnoIds.join(',') === quien) ?? null

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
          ? {
              accion, monto, tipo: e.tipo || undefined,
              detalle: c.nombre || c.contacto || undefined,
              // A quién se le marca la mensualidad. Sin nadie elegido, solo el ingreso.
              alumnoIds: e.quien ? e.quien.split(',').map(Number) : undefined,
              mes: e.quien && e.mes ? e.mes : undefined,
            }
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
            <div key={c.id} data-comp-id={c.id} className="comp-card" style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 12, padding: 10 }}>
              {/* Foto del comprobante */}
              {c.media ? (
                <button className="comp-fotoslot" onClick={() => setFoto(c.media)} title="Ver la foto completa"
                  style={{ border: 'none', padding: 0, background: 'transparent', cursor: 'zoom-in', lineHeight: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="comp-foto" src={`/api/media/${c.media}`} alt="Comprobante"
                    style={{ objectFit: 'cover', borderRadius: 9, border: '1px solid #FDE68A' }} />
                </button>
              ) : (
                <div className="comp-fotoslot comp-foto flex items-center justify-center" style={{ borderRadius: 9, background: '#FEF3C7', color: '#D97706' }}>
                  <ImageIcon size={18} />
                </div>
              )}

              {/* De quién es */}
              <div className="comp-quien">
                <p style={{ fontSize: 13, fontWeight: 700, color: '#054D44' }}>{c.nombre || c.contacto || c.telefono}</p>
                <p style={{ fontSize: 11, color: '#8696A0' }}>
                  {c.fecha}{c.banco ? ` · ${c.banco}` : ''}
                  {c.de_meta ? ' · vino de Meta' : ''}
                  {c.esperado ? '' : ' · monto poco habitual'}
                </p>
              </div>

              {/* Monto (editable) y categoría */}
              <div className="comp-campos">
                <input inputMode="numeric" value={e.monto} aria-label="Monto"
                  onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, monto: ev.target.value } }))}
                  style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#054D44' }} />
                <select value={e.tipo} onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, tipo: ev.target.value } }))}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13, background: '#fff', color: '#054D44', maxWidth: 180 }}>
                  <option value="">— categoría —</option>
                  {INGRESO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* ¿De quién es este pago? El enganche con la ficha del alumno */}
              <div className="comp-enganche">
                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#054D44' }}>¿De quién es este pago?</span>
                  <select aria-label="¿De quién es este pago?" value={e.quien}
                    onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, quien: ev.target.value } }))}
                    style={{ flex: 1, minWidth: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13, background: '#fff', color: '#054D44' }}>
                    <option value="">— de nadie, solo anotar el ingreso —</option>
                    {(c.propuesta?.candidatos.length ?? 0) > 0 && (
                      <optgroup label="Lo que propone la app">
                        {c.propuesta!.candidatos.map(x => (
                          <option key={x.alumnoIds.join(',')} value={x.alumnoIds.join(',')}>{x.etiqueta}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Todos los alumnos">
                      {alumnos.map(a => <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
                    </optgroup>
                  </select>
                  {e.quien && (
                    <input type="month" aria-label="Mes que se marca pagado" value={e.mes}
                      onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, mes: ev.target.value } }))}
                      style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13, color: '#054D44' }} />
                  )}
                </div>
                {(() => {
                  const cand = candidatoDe(c, e.quien)
                  if (!e.quien) {
                    // Con candidatos pero sin preseleccionado hay una duda de verdad
                    // (dos hermanos, o el que ya pagó): se le pide que elija, en vez de
                    // dejar el campo mudo y que el pago se pierda sin dueño.
                    const n = c.propuesta?.candidatos.length ?? 0
                    return n > 0 ? (
                      <p style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>
                        Hay {n === 1 ? '1 alumno posible' : `${n} alumnos posibles`}: ábrelo y elige de quién es,
                        o déjalo así y solo se anota el ingreso.
                      </p>
                    ) : (
                      <p style={{ fontSize: 11, color: '#8696A0', marginTop: 4 }}>
                        No se pudo saber de quién es. Elige el alumno en la lista, o déjalo así y solo se anota el ingreso.
                      </p>
                    )
                  }
                  return (
                    <p style={{ fontSize: 11, color: cand?.avisos.length ? '#B45309' : '#8696A0', marginTop: 4 }}>
                      {cand ? cand.razon : 'lo elegiste tú a mano'}
                      {cand?.avisos.length ? ` · ⚠ ${cand.avisos.join(' · ')}` : ''}
                    </p>
                  )
                })()}
              </div>

              {/* Los dos botones */}
              <div className="comp-acciones">
                <button onClick={() => accion(c, 'aprobar')} disabled={trabajando} className="comp-aprobar flex items-center gap-1"
                  style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: '#00A884', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: trabajando ? 'default' : 'pointer', opacity: trabajando ? 0.6 : 1 }}>
                  <Check size={15} /> {trabajando ? 'Guardando…' : 'Aprobar'}
                </button>
                <button onClick={() => accion(c, 'descartar')} disabled={trabajando} title="Descartar" aria-label="Descartar"
                  className="comp-descartar flex items-center"
                  style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid #D3E7DE', background: '#fff', color: '#8696A0', cursor: trabajando ? 'default' : 'pointer', opacity: trabajando ? 0.6 : 1 }}>
                  <X size={15} />
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
