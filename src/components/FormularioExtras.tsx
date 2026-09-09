'use client'

// Lo que se agrega al calendario aparte de una clase suelta: un ALUMNO que se repite
// todas las semanas, un PAGO que vuelve todos los meses y un RECORDATORIO.
//
// Lukas, 10-08-2026: "que en calendario hayan pagos que también se repitan, que puede ser
// arriendo, suscripción, sueldos y otros —cuando ponga otros que aparezca una descripción—,
// alumnos que se repitan y que aparezcan de forma estructurada y ordenada, y recordatorios
// y ese también que ponga descripción".
//
// Vive aparte de la pantalla del calendario a propósito: ahí ya está el formulario de la
// clase suelta con su selector de alumnos y su dictado por voz, y mezclarlo todo en un
// archivo hace que un arreglo en uno rompa el otro.

import { useState } from 'react'
import { DIAS, DIA_LABEL, PROFES, profeColor } from '@/lib/calendario'

export type TipoExtra = 'alumno' | 'pago' | 'recordatorio'

// Un horario de los que ya existen: día, hora, hora de salida y profesora, con la
// gente que ya está dentro. Sale de las inscripciones (el horario de verdad desde
// el 26-08-2026), no de las clases fijas viejas: un alumno agregado aquí tiene que
// aparecer en el CRM y poder avisar que no viene, como todos los demás.
export type HorarioSala = {
  clave: string; dia: string; hora: string; horaFin: string | null
  profe: string | null; alumnos: string[]
}

const TIPOS_PAGO = [
  { valor: 'arriendo', etiqueta: 'Arriendo' },
  { valor: 'sueldos', etiqueta: 'Sueldos' },
  { valor: 'suscripcion', etiqueta: 'Suscripción' },
  { valor: 'otros', etiqueta: 'Otros' },
]

const label: React.CSSProperties = { fontSize: 12, color: '#667781' }
const campo: React.CSSProperties = {
  width: '100%', marginTop: 4, minHeight: 44, padding: '10px 12px', borderRadius: 8,
  border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 14, background: '#fff',
  color: '#111B21', outline: 'none',
}
const ayuda: React.CSSProperties = { fontSize: 11.5, color: '#8696A0', marginTop: 6 }

export default function FormularioExtras({
  tipo, fecha, horarios, onClose, onGuardado,
}: {
  tipo: TipoExtra
  fecha: string
  horarios: HorarioSala[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Alumno que se repite ──────────────────────────────────────────────────
  const [nombre, setNombre] = useState('')
  const [horarioId, setHorarioId] = useState<string>(horarios[0]?.clave ?? 'nuevo')
  const [dia, setDia] = useState<string>(DIAS[0])
  const [hora, setHora] = useState('17:30')
  const [horaFin, setHoraFin] = useState('19:30')
  const [profe, setProfe] = useState(PROFES[0].nombre)

  // ── Pago que vuelve cada mes ──────────────────────────────────────────────
  const [tipoPago, setTipoPago] = useState('arriendo')
  const [monto, setMonto] = useState('')
  const [diaMes, setDiaMes] = useState('5')
  const [descripcionPago, setDescripcionPago] = useState('')

  // ── Recordatorio ──────────────────────────────────────────────────────────
  const [texto, setTexto] = useState('')
  const [fechaRec, setFechaRec] = useState(fecha)
  const [horaRec, setHoraRec] = useState('09:00')
  const [avisar, setAvisar] = useState(true)

  const rango = (h: HorarioSala) =>
    `${DIA_LABEL[h.dia] ?? h.dia} ${h.hora}${h.horaFin ? ` a ${h.horaFin}` : ''} · ${h.profe ?? 'sin profesora'}`

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return // doble toque en el teléfono = un solo registro
    setError(''); setGuardando(true)
    try {
      let r: Response
      if (tipo === 'alumno') {
        if (!nombre.trim()) throw new Error('Escribe el nombre del alumno.')
        // Dónde va: en un horario que ya existe o en uno nuevo. Se guarda como
        // ficha + inscripción (el modelo de verdad), así entra al CRM con su
        // mensualidad y puede avisar que no viene, igual que el resto.
        let destino = { dia, hora, horaFin: horaFin || null, profe: profe as string | null }
        if (horarioId !== 'nuevo') {
          const h = horarios.find(x => x.clave === horarioId)
          if (!h) throw new Error('Ese horario ya no existe, recarga la página.')
          if (h.alumnos.some(a => a.toLowerCase() === nombre.trim().toLowerCase())) {
            throw new Error(`${nombre.trim()} ya está en ese horario.`)
          }
          destino = { dia: h.dia, hora: h.hora, horaFin: h.horaFin, profe: h.profe }
        }
        const alta = await fetch('/api/alumnos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nombre.trim() }),
        })
        const altaJson = await alta.json() as { ok: boolean; id?: number; error?: string }
        if (!altaJson.ok || !altaJson.id) throw new Error(altaJson.error || 'No se pudo crear el alumno.')
        r = await fetch(`/api/alumnos/${altaJson.id}/inscripciones`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(destino),
        })
      } else if (tipo === 'pago') {
        if (tipoPago === 'otros' && !descripcionPago.trim()) throw new Error('Escribe de qué es el pago.')
        r = await fetch('/api/pagos-fijos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: tipoPago, descripcion: descripcionPago.trim() || undefined,
            monto: parseInt(monto.replace(/\D/g, ''), 10) || 0, diaMes: parseInt(diaMes, 10),
          }),
        })
      } else {
        if (!texto.trim()) throw new Error('Escribe de qué es el recordatorio.')
        r = await fetch('/api/recordatorios', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha: fechaRec, hora: horaRec || undefined, texto: texto.trim(), avisar }),
        })
      }
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || 'No se pudo guardar. Reintenta.')
      onGuardado()
      onClose()
    } catch (err) {
      setError((err as Error).message || 'No se pudo guardar. Revisa tu internet.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar}>
      {tipo === 'alumno' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Nombre del alumno</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Amelia" style={campo} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>¿En qué horario?</label>
            {/* Era un <select> y tenía dos problemas (Lukas, 08-09-2026): los horarios
                salían en desorden —"primero aparece el jueves, después el lunes"— y en
                el Safari del iPhone un <option> NO se puede pintar de color, así que no
                había forma de ver de quién era cada hora. Ahora es una lista de botones
                agrupada de lunes a sábado, con el punto verde de Mary o morado de Paula
                y 44 px de alto para tocarla con el dedo. */}
            <div style={{ marginTop: 6, maxHeight: 260, overflowY: 'auto', border: '1px solid #E7F1EC', borderRadius: 10 }}>
              {DIAS.filter(d => horarios.some(h => h.dia === d)).map(d => (
                <div key={d}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA7AD', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px 4px', background: '#FAFCFB' }}>
                    {DIA_LABEL[d] ?? d}
                  </p>
                  {horarios.filter(h => h.dia === d).map(h => {
                    const pc = profeColor(h.profe ?? '')
                    const sel = horarioId === h.clave
                    return (
                      <button type="button" key={h.clave} data-horario={h.clave} data-dia={h.dia} data-profe={h.profe ?? 'sin-profe'} onClick={() => setHorarioId(h.clave)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, minHeight: 44, padding: '8px 12px',
                          border: 'none', borderBottom: '1px solid #F3F9F6', cursor: 'pointer', fontFamily: 'inherit',
                          textAlign: 'left', background: sel ? '#E7F1EC' : '#fff' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: pc.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: sel ? 700 : 500, color: '#1F2937' }}>
                          {h.hora}{h.horaFin ? ` a ${h.horaFin}` : ''}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: pc.color }}>{h.profe ?? 'sin profesora'}</span>
                        <span style={{ fontSize: 11, color: '#9AA7AD' }}>{h.alumnos.length}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
              <button type="button" data-horario="nuevo" onClick={() => setHorarioId('nuevo')}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, minHeight: 44, padding: '8px 12px',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 14, fontWeight: 700,
                  color: '#008069', background: horarioId === 'nuevo' ? '#E7F1EC' : '#fff' }}>
                ➕ Crear un horario nuevo
              </button>
            </div>
            <p style={ayuda}>El alumno queda en ese horario y aparece TODAS las semanas, sin volver a escribirlo. También entra a la pestaña Alumnos, donde se le pone la mensualidad.</p>
          </div>
          {horarioId === 'nuevo' && (
            <>
              <div className="flex gap-2" style={{ marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Día</label>
                  <select value={dia} onChange={e => setDia(e.target.value)} style={campo}>
                    {DIAS.map(d => <option key={d} value={d}>{DIA_LABEL[d]}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Profe</label>
                  <select value={profe} onChange={e => setProfe(e.target.value)} style={campo}>
                    {PROFES.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2" style={{ marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Desde</label>
                  <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={campo} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Hasta</label>
                  <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} style={campo} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tipo === 'pago' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>¿De qué es el pago?</label>
            <select value={tipoPago} onChange={e => setTipoPago(e.target.value)} style={campo}>
              {TIPOS_PAGO.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{tipoPago === 'otros' ? 'Descripción (obligatoria)' : 'Descripción (opcional)'}</label>
            <input value={descripcionPago} onChange={e => setDescripcionPago(e.target.value)}
              placeholder={tipoPago === 'otros' ? 'Ej: materiales de acuarela' : 'Ej: local de Picarte'} style={campo} />
          </div>
          <div className="flex gap-2" style={{ marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Monto</label>
              <input value={monto} onChange={e => setMonto(e.target.value)} inputMode="numeric" placeholder="250000" style={campo} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Día del mes</label>
              <input value={diaMes} onChange={e => setDiaMes(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="5" style={campo} />
            </div>
          </div>
          <p style={ayuda}>Vuelve todos los meses. Si pones 31, en febrero cae el último día, no se salta el mes.</p>
        </>
      )}

      {tipo === 'recordatorio' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>¿Qué hay que recordar?</label>
            <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ej: comprar acuarelas" style={campo} />
          </div>
          <div className="flex gap-2" style={{ marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Día</label>
              <input type="date" value={fechaRec} onChange={e => setFechaRec(e.target.value)} style={campo} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Hora</label>
              <input type="time" value={horaRec} onChange={e => setHoraRec(e.target.value)} style={campo} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, cursor: 'pointer' }}>
            <input type="checkbox" checked={avisar} onChange={e => setAvisar(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: '#00A884' }} />
            <span style={{ fontSize: 13, color: '#374151' }}>Quiero que me avisen</span>
          </label>
          <p style={ayuda}>El aviso es para TI, Mary: te llega por WhatsApp a tu propio número, a la hora
            que pongas (sin hora, a las 09:00). Nunca se le escribe a un apoderado.</p>
        </>
      )}

      {error && (
        <p style={{ fontSize: 12.5, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>{error}</p>
      )}

      <button type="submit" disabled={guardando}
        style={{ width: '100%', marginTop: 14, minHeight: 46, borderRadius: 9, border: 'none', background: guardando ? '#A7D8CC' : '#00A884', color: '#fff', fontWeight: 700, fontSize: 14, cursor: guardando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
