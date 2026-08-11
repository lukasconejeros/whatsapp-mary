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
import { DIAS, DIA_LABEL, PROFES } from '@/lib/calendario'

export type TipoExtra = 'alumno' | 'pago' | 'recordatorio'

type ClaseFija = {
  id: number; dia: string; hora: string; horaFin: string | null
  profe: string; alumnos: string[]; cuposPrueba: number; activa: boolean
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
  tipo, fecha, fijas, onClose, onGuardado,
}: {
  tipo: TipoExtra
  fecha: string
  fijas: ClaseFija[]
  onClose: () => void
  onGuardado: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // ── Alumno que se repite ──────────────────────────────────────────────────
  const [nombre, setNombre] = useState('')
  const [horarioId, setHorarioId] = useState<string>(String(fijas[0]?.id ?? 'nuevo'))
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

  const rango = (f: ClaseFija) => `${DIA_LABEL[f.dia] ?? f.dia} ${f.hora}${f.horaFin ? ` a ${f.horaFin}` : ''} · ${f.profe}`

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return // doble toque en el teléfono = un solo registro
    setError(''); setGuardando(true)
    try {
      let r: Response
      if (tipo === 'alumno') {
        if (!nombre.trim()) throw new Error('Escribe el nombre del alumno.')
        if (horarioId === 'nuevo') {
          r = await fetch('/api/clases-fijas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dia, hora, horaFin, profe, alumnos: [nombre.trim()], cuposPrueba: 0 }),
          })
        } else {
          // Se suma al horario que ya existe sin pisar a los que ya venían.
          const f = fijas.find(x => x.id === Number(horarioId))
          if (!f) throw new Error('Ese horario ya no existe, recarga la página.')
          if (f.alumnos.some(a => a.toLowerCase() === nombre.trim().toLowerCase())) {
            throw new Error(`${nombre.trim()} ya está en ese horario.`)
          }
          r = await fetch(`/api/clases-fijas/${f.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dia: f.dia, hora: f.hora, horaFin: f.horaFin, profe: f.profe,
              alumnos: [...f.alumnos, nombre.trim()], cuposPrueba: f.cuposPrueba, activa: f.activa,
            }),
          })
        }
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
            <select value={horarioId} onChange={e => setHorarioId(e.target.value)} style={campo}>
              {fijas.filter(f => f.activa).map(f => <option key={f.id} value={f.id}>{rango(f)}</option>)}
              <option value="nuevo">➕ Crear un horario nuevo</option>
            </select>
            <p style={ayuda}>El alumno queda en ese horario y aparece TODAS las semanas, sin volver a escribirlo.</p>
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
          <p style={ayuda}>El aviso es para TI, Mary. Nunca se le escribe a un apoderado. Ojo: el envío
            todavía no está encendido, por ahora el recordatorio queda anotado en el calendario.</p>
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
