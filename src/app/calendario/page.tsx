'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AppNav from '@/components/AppNav'
import FormularioExtras, { type TipoExtra, type HorarioSala } from '@/components/FormularioExtras'
import { DIA_LABEL, PROFES, PROFE_NOMBRES, profeColor, diaFromFecha } from '@/lib/calendario'
import { bloquesDelDia, type Ausencia, type InscripcionConAlumno, type AlumnoEnDia } from '@/lib/dia-clases'
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight, Mic, Keyboard } from 'lucide-react'

type Clase = { id: number; fecha: string | null; dia: string; profe: string; hora: string | null; alumnos: (string | number)[]; nota: string | null }
// Clase que se repite TODAS las semanas (los alumnos fijos de Mary). Una fila vale
// para todos los lunes, así que no tiene fecha: tiene día.
type ClaseFija = { id: number; dia: string; hora: string; horaFin: string | null; profe: string; alumnos: string[]; cuposPrueba: number; activa: boolean }
// Pago que vuelve TODOS los meses (arriendo, sueldos, suscripción, otros).
type PagoFijo = { id: number; tipo: string; descripcion: string | null; monto: number; diaMes: number; activo: boolean }
// Recordatorio puntual de Mary: el aviso va a SU WhatsApp, nunca al apoderado.
type Recordatorio = { id: number; fecha: string; hora: string | null; texto: string; avisar: boolean; enviadoAt: number | null; hecho: boolean; outboxId?: number | null }
type ClienteLite = { id: number; nombre: string | null; telefono: string; horario: string[] }
// Quién vino y quién faltó. Lo llena el pase de lista de las 21:00 por WhatsApp,
// y ella lo corrige tocando el puntito (ahí queda con fuente 'panel').
type AsistenciaRow = { id: number; fecha: string; alumno: string; estado: 'vino' | 'falto'; fuente: string }
type Form = { fecha: string; profe: string; hora: string; alumnos: number[]; alumnosExtra: (string | number)[]; nota: string }

// Reconocimiento de voz nativo (webkitSpeechRecognition), mismo patrón que el Asistente.
interface SREvent { resultIndex: number; results: { length: number; [i: number]: { isFinal?: boolean; 0: { transcript: string } } } }
interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: SREvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null
  start: () => void; stop: () => void
}
function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// En el computador cabe el nombre corto; en el teléfono va la inicial sola, como
// el Calendario del iPhone que pidió copiar Lukas (27-08-2026): L M M J V S D.
const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DOW_INICIAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const TITULO_TIPO: Record<string, string> = {
  clase: 'clase', alumno: 'alumno', pago: 'pago', recordatorio: 'recordatorio',
}
const ETIQUETA_PAGO: Record<string, string> = {
  arriendo: 'Arriendo', sueldos: 'Sueldos', suscripcion: 'Suscripción', otros: 'Otros',
}
const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`

// Fecha local → 'YYYY-MM-DD' (sin pasar por UTC, evita corrimientos de día).
function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function capital(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }
function fechaLarga(f: string): string {
  const d = new Date(`${f}T12:00:00`)
  return capital(d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }))
}

export default function CalendarioPage() {
  const hoy = ymd(new Date())
  const [cursor, setCursor] = useState(() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() } })
  const [sel, setSel] = useState<string>(hoy)
  const [clases, setClases] = useState<Clase[]>([])
  const [fijas, setFijas] = useState<ClaseFija[]>([])
  const [pagos, setPagos] = useState<PagoFijo[]>([])
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([])
  const [clientes, setClientes] = useState<ClienteLite[]>([])
  const [asistencia, setAsistencia] = useState<AsistenciaRow[]>([])
  // El horario de verdad: cada alumno con su día, su hora de salida y su profesora.
  // Vale para todas las semanas, así que se pide UNA vez y dibuja el mes entero.
  const [inscripciones, setInscripciones] = useState<InscripcionConAlumno[]>([])
  // Los avisos de "no viene" (un día suelto o el mes entero): pintan el gris.
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  // El alumno cuyo menú está abierto (vino / faltó / no viene / sin marcar).
  const [menu, setMenu] = useState<{ fecha: string; alumno: AlumnoEnDia | null; nombre: string } | null>(null)
  // Segunda pregunta del menú: "¿solo este día o todo el mes?" (Lukas, 26-08-2026).
  const [pasoNoViene, setPasoNoViene] = useState(false)
  const [filtro, setFiltro] = useState<string>('Todas')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  // Qué se está agregando al calendario. La clase suelta es la de siempre; alumno, pago y
  // recordatorio los pidió Lukas el 10-08-2026 y viven en FormularioExtras.
  const [tipoForm, setTipoForm] = useState<'clase' | TipoExtra>('clase')
  const [guardando, setGuardando] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Form>({ fecha: hoy, profe: 'Mary', hora: '16:00', alumnos: [], alumnosExtra: [], nota: '' })
  const [search, setSearch] = useState('')
  // Agendar por VOZ
  const [showVoz, setShowVoz] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [creandoVoz, setCreandoVoz] = useState(false)
  const [transcribiendo, setTranscribiendo] = useState(false)
  const srRef = useRef<SpeechRec | null>(null)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Celdas de la grilla del mes (semanas completas, lunes→domingo).
  const first = new Date(cursor.y, cursor.m, 1)
  const offset = (first.getDay() + 6) % 7 // 0 = lunes
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7
  const cells: Date[] = Array.from({ length: totalCells }, (_, i) => new Date(cursor.y, cursor.m, 1 - offset + i))
  const desde = ymd(cells[0])
  const hasta = ymd(cells[cells.length - 1])

  const load = useCallback(async (d: string, h: string) => {
    setLoading(true)
    try {
      const [c, cl, fj, pg, rc, as, ins, au] = await Promise.all([
        fetch(`/api/clases?desde=${d}&hasta=${h}`).then(r => r.json()),
        fetch('/api/clientes').then(r => r.json()),
        fetch('/api/clases-fijas').then(r => r.json()),
        fetch('/api/pagos-fijos').then(r => r.json()),
        fetch(`/api/recordatorios?desde=${d}&hasta=${h}`).then(r => r.json()),
        fetch(`/api/asistencia?desde=${d}&hasta=${h}`).then(r => r.json()),
        fetch('/api/inscripciones').then(r => r.json()),
        fetch(`/api/ausencias?desde=${d}&hasta=${h}`).then(r => r.json()),
      ])
      if (as.ok) setAsistencia(as.asistencia)
      if (c.ok) setClases(c.clases)
      if (cl.ok) setClientes(cl.clientes)
      if (fj.ok) setFijas(fj.clasesFijas)
      if (pg.ok) setPagos(pg.pagosFijos)
      if (rc.ok) setRecordatorios(rc.recordatorios)
      if (ins.ok) setInscripciones(ins.inscripciones)
      if (au.ok) setAusencias(au.ausencias)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(desde, hasta) }, [load, desde, hasta])

  function goMonth(delta: number) {
    const nd = new Date(cursor.y, cursor.m + delta, 1)
    const y = nd.getFullYear(), m = nd.getMonth()
    const t = new Date()
    setSel(ymd(y === t.getFullYear() && m === t.getMonth() ? t : nd))
    setCursor({ y, m })
  }
  function irHoy() {
    const t = new Date()
    setCursor({ y: t.getFullYear(), m: t.getMonth() })
    setSel(ymd(t))
  }

  function openNew(fecha: string) {
    setEditId(null); setSearch(''); setTipoForm('clase')
    setForm({ fecha, profe: 'Mary', hora: '16:00', alumnos: [], alumnosExtra: [], nota: '' })
    setShowForm(true)
  }
  function openEdit(c: Clase) {
    setEditId(c.id); setSearch(''); setTipoForm('clase')
    const nums = c.alumnos.filter((a): a is number => typeof a === 'number')
    const extra = c.alumnos.filter((a) => typeof a !== 'number')
    setForm({ fecha: c.fecha ?? sel, profe: c.profe, hora: c.hora ?? '', alumnos: nums, alumnosExtra: extra, nota: c.nota ?? '' })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null) }

  // ── Agendar por VOZ (dictado nativo + respaldo por servidor, como el Asistente) ──
  function abrirVoz() { setTranscript(''); setShowVoz(true) }
  function pararVoz() { try { srRef.current?.stop() } catch { /* noop */ } try { mrRef.current?.stop() } catch { /* noop */ } }
  function cerrarVoz() { pararVoz(); setListening(false); setShowVoz(false) }

  function toggleEscucha() {
    if (listening) { pararVoz(); setListening(false); return }
    // 1) Dictado NATIVO del teléfono (gratis). continuous=false para que funcione en iOS.
    const SR = getSpeechRecognition()
    if (SR) {
      try {
        const rec = new SR()
        rec.lang = 'es-CL'; rec.interimResults = true; rec.continuous = false
        let finalText = ''
        rec.onresult = (e: SREvent) => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]; const t = r[0].transcript
            if (r.isFinal) finalText += t; else interim += t
          }
          setTranscript((finalText + interim).trim())
        }
        rec.onerror = () => setListening(false)
        rec.onend = () => { setListening(false); const t = finalText.trim(); if (t) setTranscript(t) }
        rec.start(); srRef.current = rec; setListening(true)
        return
      } catch { setListening(false) }
    }
    // 2) Respaldo: grabar y transcribir en el servidor (reusa el endpoint del Asistente).
    grabarYTranscribir()
  }

  async function grabarYTranscribir() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setListening(false)
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        setTranscribiendo(true)
        try {
          const form = new FormData()
          form.append('file', blob, 'audio.webm')
          const d = await fetch('/api/asistente/transcribir', { method: 'POST', body: form }).then(r => r.json())
          if (d.ok && d.texto) setTranscript(d.texto)
          else alert('No te escuché bien. Intenta de nuevo o escribe la clase abajo.')
        } catch { alert('No se pudo transcribir. Escribe la clase abajo.') }
        finally { setTranscribiendo(false) }
      }
      rec.start(); mrRef.current = rec; setListening(true)
    } catch {
      setListening(false)
      alert('No pude usar el micrófono. Dale permiso al micrófono, o escribe la clase abajo.')
    }
  }

  async function crearPorVoz() {
    const texto = transcript.trim()
    if (!texto || creandoVoz) return
    pararVoz()
    setListening(false); setCreandoVoz(true)
    try {
      const d = await fetch('/api/clases/voz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, fecha: sel }) }).then(r => r.json())
      if (d.ok && d.clases?.length) {
        setShowVoz(false); setTranscript('')
        setSel(d.clases[0].fecha)
        load(desde, hasta)
        if (d.clases.length > 1) alert(`Listo: ${d.clases.length} clases agendadas.`)
      } else alert(d.error || 'No se pudo agendar')
    } catch { alert('No se pudo agendar. Revisa tu internet.') }
    finally { setCreandoVoz(false) }
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (guardando) return // evita doble registro por doble toque
    setGuardando(true)
    try {
      const url = editId ? `/api/clases/${editId}` : '/api/clases'
      const body = {
        fecha: form.fecha,
        dia: diaFromFecha(form.fecha),
        profe: form.profe,
        hora: form.hora || undefined,
        alumnos: [...form.alumnos, ...form.alumnosExtra],
        nota: form.nota.trim() || undefined,
      }
      const r = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if ((await r.json()).ok) { closeForm(); load(desde, hasta) }
      else alert('No se pudo guardar. Reintenta.')
    } catch { alert('No se pudo guardar. Revisa tu internet.') }
    finally { setGuardando(false) }
  }
  async function del(c: Clase) {
    if (!confirm('¿Borrar esta clase? No se puede deshacer.')) return
    try {
      if ((await fetch(`/api/clases/${c.id}`, { method: 'DELETE' }).then(x => x.json())).ok) load(desde, hasta)
      else alert('No se pudo borrar. Reintenta.')
    } catch { alert('No se pudo borrar. Revisa tu internet.') }
  }

  // ── Asistencia: el puntito de cada alumno ────────────────────────────────
  // Verde vino, rojo faltó, gris sin marcar. Lo normal es que lo llene solo el
  // pase de lista de las 21:00; esto es para corregirlo con el dedo.
  const COLOR_ASIS: Record<string, string> = { vino: '#00A884', falto: '#EF4444' }
  const estadoAsis = (fecha: string, alumno: string) =>
    asistencia.find(a => a.fecha === fecha && a.alumno === alumno)?.estado ?? null

  // Marca (o desmarca) a un alumno un día. Antes el chip ciclaba con cada toque;
  // ahora abre un menú, porque los estados son cuatro y adivinar cuál venía
  // después era una lotería (Lukas, 26-08-2026).
  const fijarAsis = async (fecha: string, alumno: string, estado: 'vino' | 'falto' | null) => {
    // Se pinta al tiro y después se guarda: el toque tiene que sentirse inmediato.
    setAsistencia(prev => {
      const otros = prev.filter(a => !(a.fecha === fecha && a.alumno === alumno))
      return estado ? [...otros, { id: -1, fecha, alumno, estado, fuente: 'panel' }] : otros
    })
    try {
      const r = await fetch('/api/asistencia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, alumno, estado }),
      })
      if (!r.ok) throw new Error('no se guardó')
    } catch {
      alert('No se pudo guardar. Revisa tu internet.')
      load(desde, hasta)
    }
  }

  // ── El botón "no viene" ───────────────────────────────────────────────────
  // Mary avisa ANTES de la clase y la app le pregunta si es solo ese día o el mes
  // entero. NO es lo mismo que marcar "faltó": eso es lo que pasó, esto es lo que
  // se sabe de antes, y por eso sale gris y no rojo.
  async function noViene(alumnoId: number, nombre: string, fecha: string, tipo: 'dia' | 'mes') {
    try {
      const r = await fetch('/api/ausencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipo === 'dia' ? { alumnoId, tipo, fecha } : { alumnoId, tipo, mes: fecha.slice(0, 7) }),
      })
      const d = await r.json() as { ok: boolean }
      if (!d.ok) throw new Error('no se guardó')
      // Si ese día ya estaba marcado (vino o faltó), el aviso manda y se limpia:
      // no puede quedar en rojo alguien que avisó con tiempo. Las faltas de los
      // OTROS días no se tocan: son historia real y dan sus recuperativas.
      if (tipo === 'dia' && estadoAsis(fecha, nombre)) await fijarAsis(fecha, nombre, null)
      load(desde, hasta)
    } catch { alert('No se pudo guardar. Revisa tu internet.') }
  }

  async function siViene(ausenciaId: number) {
    try {
      await fetch(`/api/ausencias/${ausenciaId}`, { method: 'DELETE' })
      load(desde, hasta)
    } catch { alert('No se pudo guardar. Revisa tu internet.') }
  }

  // ── Quién viene cada día: las salas del horario de Mary ───────────────────
  // Una sala por profesora, con la gente que le toca ese día; cada alumno con SU
  // hora de salida. Es la misma función que usa el WhatsApp de las 10:00, para que
  // la pantalla y el mensaje nunca digan cosas distintas.
  const salasDe = (fecha: string) => {
    const dia = diaFromFecha(fecha)
    const delDia = inscripciones.filter(i => i.dia === dia && (filtro === 'Todas' || (i.profe ?? '') === filtro))
    return bloquesDelDia(fecha, delDia, ausencias)
  }
  const salasSel = salasDe(sel)
  const rangoSala = (h: string, f: string | null) => f ? `${h} a ${f}` : h

  // Los horarios que ya existen, para el selector de "agregar un alumno": cada
  // combinación de día + hora + profesora que ya tiene gente dentro.
  const horariosExistentes: HorarioSala[] = (() => {
    const m = new Map<string, HorarioSala>()
    for (const i of inscripciones) {
      if (!i.dia) continue
      const clave = `${i.dia}|${i.hora}|${i.horaFin ?? ''}|${i.profe ?? ''}`
      const ya = m.get(clave)
      if (ya) ya.alumnos.push(i.nombre)
      else m.set(clave, { clave, dia: i.dia, hora: i.hora, horaFin: i.horaFin, profe: i.profe, alumnos: [i.nombre] })
    }
    return [...m.values()].sort((a, b) => a.dia.localeCompare(b.dia) || a.hora.localeCompare(b.hora))
  })()

  // El chip de un alumno suelto (clases viejas y eventos puntuales): sin ficha no
  // se le puede avisar una ausencia, así que solo lleva vino / faltó / sin marcar.
  const chipAlumno = (fecha: string, nombre: string, borde: string) => {
    const est = estadoAsis(fecha, nombre)
    return (
      // El botón mide 44 px de alto (lo mínimo para tocarlo bien en el teléfono),
      // pero el chip de dentro sigue siendo chico: se ve igual que antes.
      <button key={`${fecha}-${nombre}`} onClick={() => setMenu({ fecha, alumno: null, nombre })}
        title={est === 'vino' ? 'Vino — toca para cambiar' : est === 'falto' ? 'Faltó — toca para cambiar' : 'Sin marcar — toca para marcar'}
        style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, minWidth: 44, padding: '0 2px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151', background: '#fff', border: `1px solid ${borde}`, borderRadius: 6, padding: '3px 7px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: est ? COLOR_ASIS[est] : '#D1D5DB' }} />
          {nombre}
        </span>
      </button>
    )
  }

  // El chip de un alumno CON ficha: además de vino/faltó puede avisar que no viene,
  // y entonces se ve gris y tachado ("que se ponga en gris en el calendario ese día").
  const chipInscrito = (fecha: string, a: AlumnoEnDia, borde: string) => {
    const avisado = a.estado !== 'normal'
    const est = estadoAsis(fecha, a.nombre)
    const titulo = a.estado === 'aviso-mes' ? 'No viene en todo el mes — toca para cambiar'
      : a.estado === 'aviso-dia' ? 'Avisó que no viene este día — toca para cambiar'
      : est === 'vino' ? 'Vino — toca para cambiar'
      : est === 'falto' ? 'Faltó — toca para cambiar' : 'Sin marcar — toca para marcar'
    return (
      <button key={`i${a.inscripcionId}`} data-chip-alumno={a.nombre} data-estado={a.estado}
        onClick={() => setMenu({ fecha, alumno: a, nombre: a.nombre })} title={titulo}
        style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, minWidth: 44, padding: '0 2px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, borderRadius: 6, padding: '3px 7px',
          color: avisado ? '#9AA7AD' : '#374151',
          background: avisado ? '#F3F4F6' : '#fff',
          border: `1px solid ${avisado ? '#E5E7EB' : borde}`,
          textDecoration: avisado ? 'line-through' : 'none' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: avisado ? '#C7CDD1' : est ? COLOR_ASIS[est] : '#D1D5DB' }} />
          {a.nombre}
          <span style={{ fontSize: 10, color: avisado ? '#9AA7AD' : '#8696A0' }}>
            {a.hora}{a.horaFin ? `–${a.horaFin}` : ''}
          </span>
        </span>
      </button>
    )
  }

  // Los que faltaron en el mes que está mirando, el que falta más primero.
  const faltasMes = (() => {
    const m = new Map<string, string[]>()
    for (const a of asistencia) if (a.estado === 'falto') m.set(a.alumno, [...(m.get(a.alumno) ?? []), a.fecha])
    return [...m.entries()]
      .map(([alumno, dias]) => ({ alumno, dias: [...dias].sort() }))
      .sort((x, y) => y.dias.length - x.dias.length || x.alumno.localeCompare(y.alumno))
  })()

  const nombreCliente = (id: number) => clientes.find(c => c.id === id)?.nombre || `#${id}`
  const etiquetaAlumno = (a: string | number) => typeof a === 'number' ? nombreCliente(a) : a
  const pasaFiltro = (c: Clase) => filtro === 'Todas' || c.profe === filtro
  const eventosDe = (fecha: string) => clases.filter(c => c.fecha === fecha && pasaFiltro(c))
  const eventosSel = eventosDe(sel)

  // Las clases que se repiten todas las semanas: a una fecha le tocan las de su día.
  // Solo las activas — el calendario muestra lo que de verdad se hace.
  // Ojo con el doble: una clase fija vieja cuyos alumnos YA están todos en el horario
  // nuevo es la misma clase migrada el 26-08-2026, y se vería dos veces. Se esconde
  // solo en ese caso: si trae a alguien que no está inscrito, se sigue mostrando.
  const fijasDe = (fecha: string) => {
    const dia = diaFromFecha(fecha)
    const inscritos = new Set(salasDe(fecha).flatMap(s => s.alumnos.map(a => a.nombre.toLowerCase())))
    return fijas
      .filter(f => f.activa && f.dia === dia && (filtro === 'Todas' || f.profe === filtro))
      .filter(f => {
        const nombres = f.alumnos.filter(Boolean)
        return !(nombres.length > 0 && nombres.every(n => inscritos.has(n.toLowerCase())))
      })
      .sort((a, b) => a.hora.localeCompare(b.hora))
  }
  const fijasSel = fijasDe(sel)
  const rango = (f: ClaseFija) => f.horaFin ? `${f.hora} a ${f.horaFin}` : f.hora

  // Los pagos que caen en una fecha. Misma regla que la base (pagosFijosDeFecha): el del 31
  // NO se salta febrero, cae el último día del mes.
  const pagosDe = (fecha: string) => {
    const d = new Date(`${fecha}T12:00:00`)
    const dia = d.getDate()
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return pagos.filter(p => p.activo && (p.diaMes > ultimo ? dia === ultimo : p.diaMes === dia))
  }
  const recordatoriosDe = (fecha: string) => recordatorios.filter(r => r.fecha === fecha)
  const pagosSel = pagosDe(sel)
  const recordatoriosSel = recordatoriosDe(sel)

  async function borrarExtra(url: string, pregunta: string) {
    if (!confirm(pregunta)) return
    try {
      if ((await fetch(url, { method: 'DELETE' }).then(x => x.json())).ok) load(desde, hasta)
      else alert('No se pudo borrar. Reintenta.')
    } catch { alert('No se pudo borrar. Revisa tu internet.') }
  }

  async function toggleHecho(r: Recordatorio) {
    try {
      await fetch(`/api/recordatorios/${r.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: r.fecha, hora: r.hora, texto: r.texto, avisar: r.avisar, hecho: !r.hecho }),
      })
      load(desde, hasta)
    } catch { alert('No se pudo guardar. Revisa tu internet.') }
  }

  // Selector de alumnos del modal: primero los que vienen ese día, con búsqueda.
  const diaForm = diaFromFecha(form.fecha)
  const clientesOrdenados = [...clientes]
    .filter(c => !search.trim() || (c.nombre ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ad = a.horario.includes(diaForm) ? 0 : 1
      const bd = b.horario.includes(diaForm) ? 0 : 1
      return ad - bd || (a.nombre ?? '').localeCompare(b.nombre ?? '')
    })
  function toggleAlumno(id: number) {
    setForm(f => ({ ...f, alumnos: f.alumnos.includes(id) ? f.alumnos.filter(x => x !== id) : [...f.alumnos, id] }))
  }

  const monthName = capital(new Date(cursor.y, cursor.m, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 shrink-0" style={{ minHeight: 48, padding: '6px 20px', background: '#FFFFFF', borderBottom: '1px solid #D3E7DE', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#054D44' }}>Calendario</span>
          <div className="flex items-center gap-1">
            <button onClick={() => goMonth(-1)} title="Mes anterior" style={{ display: 'flex', border: '1px solid #D3E7DE', background: '#fff', borderRadius: 8, padding: 5, cursor: 'pointer', color: '#008069' }}><ChevronLeft size={15} /></button>
            {/* En el teléfono este nombre sobra: abajo está el mes grande del iPhone y
                se veía dos veces ("Agosto de 2026" y "Agosto"). Acá quedan las flechas. */}
            <span className="cal-mes-barra" style={{ fontSize: 13, fontWeight: 700, color: '#054D44', minWidth: 130, textAlign: 'center' }}>{monthName}</span>
            <button onClick={() => goMonth(1)} title="Mes siguiente" style={{ display: 'flex', border: '1px solid #D3E7DE', background: '#fff', borderRadius: 8, padding: 5, cursor: 'pointer', color: '#008069' }}><ChevronRight size={15} /></button>
            <button onClick={irHoy} style={{ marginLeft: 4, border: '1px solid #D3E7DE', background: '#fff', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', color: '#667781', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>Hoy</button>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap' }}>
            {['Todas', ...PROFE_NOMBRES].map(p => {
              const active = filtro === p
              const col = p === 'Todas' ? '#054D44' : profeColor(p).color
              return (
                <button key={p} onClick={() => setFiltro(p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? col : '#D3E7DE'}`, background: active ? col : '#fff', color: active ? '#fff' : '#667781' }}>
                  {p !== 'Todas' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : profeColor(p).color, display: 'inline-block' }} />}
                  {p}
                </button>
              )
            })}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="cal-main">
            {/* Grilla del mes */}
            <section className="cal-grid">
              {/* El mes, grande y en negrita arriba de todo: es lo primero que se lee en
                  el Calendario del iPhone. En el computador estorba (ya está en la barra
                  de arriba, junto a las flechas), así que solo sale en el teléfono. */}
              <h2 className="cal-mes-titulo" data-mes-titulo
                style={{ fontSize: 32, fontWeight: 800, color: '#1F2937', lineHeight: 1.1, margin: '2px 0 10px', letterSpacing: '-0.5px', padding: '0 12px' }}>
                {capital(new Date(cursor.y, cursor.m, 1).toLocaleDateString('es-CL', { month: 'long' }))}
                {/* El año en chico al lado, como el iPhone: al pasar de diciembre a enero
                    hay que poder ver en qué año se quedó uno. */}
                <span style={{ fontSize: 17, fontWeight: 600, color: '#9AA7AD', marginLeft: 8 }}>{cursor.y}</span>
              </h2>
              <div className="cal-caja" style={{ background: '#fff', border: '1px solid #D3E7DE', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,128,105,0.06)' }}>
                {/* minmax(0,1fr) y no 1fr: una columna `1fr` no puede encoger por debajo de su
                    contenido, así que un título largo ensanchaba su día y aplastaba a los demás
                    (Lukas, 09-08: "el calendario se ve mal en el computador"). */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid #E7F1EC' }}>
                  {DOW_LABELS.map((d, i) => (
                    // Sábado y domingo en gris claro, como en el iPhone: de un vistazo se
                    // ve dónde termina la semana de trabajo (Mary igual hace clases el sábado).
                    <div key={d} data-dow={i} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: i >= 5 ? '#B0BEC5' : '#667781' }}>
                      <span className="cal-dow-largo">{d}</span>
                      <span className="cal-dow-corto">{DOW_INICIAL[i]}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                  {cells.map((cell, i) => {
                    const f = ymd(cell)
                    const inMonth = cell.getMonth() === cursor.m
                    const isHoy = f === hoy
                    const isSel = f === sel
                    const evs = eventosDe(f)
                    // Primero las clases de todas las semanas y después las sueltas,
                    // que es el orden en que Mary piensa el día.
                    // Cada clase se escribe de DOS maneras: `label` con los nombres, que es
                    // lo que cabe en el computador, y `corto` para el teléfono, donde la
                    // celda mide unos 55 px y cualquier nombre sale cortado en "Alis…".
                    // Ahí va cuánta gente viene y con qué profesora (Lukas eligió eso el
                    // 27-08-2026); los nombres quedan a un toque, en el detalle del día.
                    const chips = [
                      // Las salas del horario: los que vienen, y aparte cuántos avisaron
                      // que no. Así de un vistazo se ve si un día quedó a medias.
                      ...salasDe(f).map(s => {
                        const vienen = s.alumnos.filter(a => a.estado === 'normal').map(a => a.nombre)
                        const fuera = s.alumnos.length - vienen.length
                        const label = [vienen.join(', ') || 'nadie', fuera ? `${fuera} no ${fuera === 1 ? 'viene' : 'vienen'}` : '']
                          .filter(Boolean).join(' · ')
                        // En el teléfono NO cabe el nombre de la profesora ("5 Pa…"), y además
                        // sobra: cada una tiene su color y su leyenda arriba. Va el número de
                        // alumnos, que es lo que no se puede saber mirando el color.
                        return { key: `s${f}-${s.profe ?? 'sp'}`, pc: profeColor(s.profe ?? ''), hora: s.hora, label,
                          corto: String(vienen.length), fija: true }
                      }),
                      ...fijasDe(f).map(x => ({ key: `f${x.id}`, pc: profeColor(x.profe), hora: x.hora, label: x.alumnos.join(', ') || x.profe,
                        corto: String(x.alumnos.length), fija: true })),
                      // Una clase suelta o un recado no tiene "cuántos vienen" que valga:
                      // ahí va la hora sin los minutos, con una "h" pegada ("19h") para que
                      // no se confunda con el número de alumnos de las salas ("19" alumnos
                      // no existe, pero de un vistazo se leía igual).
                      ...evs.map(x => ({ key: `c${x.id}`, pc: profeColor(x.profe), hora: x.hora ?? '', label: x.nota || (x.alumnos.length ? x.alumnos.map(etiquetaAlumno).join(', ') : x.profe),
                        corto: x.hora ? `${Number(x.hora.slice(0, 2))}h` : '·', fija: false })),
                    ]
                    return (
                      <button key={i} onClick={() => setSel(f)} className="cal-cell" data-fecha={f} data-fuera-mes={inMonth ? '0' : '1'}
                        style={{ position: 'relative', minHeight: 92, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 3,
                          padding: '5px 5px 6px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                          // Solo línea abajo: el iPhone separa las SEMANAS, no los días entre sí.
                          border: 'none', borderBottom: (i < cells.length - 7) ? '1px solid #E7F1EC' : 'none',
                          background: isSel ? '#E7F1EC' : inMonth ? '#fff' : '#FAFCFB',
                          boxShadow: isSel && !isHoy ? 'inset 0 0 0 1.5px #F9A8D4' : 'none' }}>
                        {/* Hoy: número blanco dentro de un círculo lleno (en el iPhone es rojo;
                            acá va el verde de la casa). El círculo es redondo de verdad —
                            ancho y alto iguales— si no, con dos cifras sale ovalado. */}
                        <span data-num {...(isHoy ? { 'data-hoy-num': true } : {})}
                          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999,
                            fontSize: 13, fontWeight: isHoy ? 800 : 600,
                            background: isHoy ? '#00A884' : 'transparent', color: isHoy ? '#fff' : inMonth ? '#1F2937' : '#B0BEC5' }}>{cell.getDate()}</span>
                        {/* Las etiquetas, ESCRITAS dentro de la celda — en el teléfono también
                            (antes ahí solo había puntitos de color y no se leía nada, que es
                            justo lo que Lukas pidió cambiar el 27-08-2026). Cada una es una
                            píldora con fondo suave y su puntito de color a la izquierda, como
                            en el Calendario del iPhone. El texto largo se corta con puntos. */}
                        <div className="cal-ev-full" style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                          {chips.slice(0, 3).map(ch => (
                            <span key={ch.key} data-ev title={`${ch.hora} ${ch.label}`.trim()}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, lineHeight: 1.35, minWidth: 0,
                                background: ch.pc.bg, color: '#3f2a35', borderRadius: 999, padding: '2px 6px' }}>
                              <span data-ev-punto style={{ width: 6, height: 6, borderRadius: '50%', background: ch.pc.color, flexShrink: 0 }} />
                              {/* La hora solo en el computador: en el teléfono la celda es angosta y
                                  "16:00" se comía el renglón entero dejando los nombres en "…".
                                  Lo que Mary necesita leer de un vistazo es QUIÉN viene; la hora
                                  exacta está un toque más allá, en el detalle del día. */}
                              {ch.hora ? <b className="cal-ev-hora" style={{ color: ch.pc.color, flexShrink: 0 }}>{ch.hora}</b> : null}
                              <span className="cal-ev-largo" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{ch.label}</span>
                              <span className="cal-ev-corto" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, fontWeight: 600 }}>{ch.corto}</span>
                            </span>
                          ))}
                          {chips.length > 3 && <span style={{ fontSize: 10, color: '#667781', paddingLeft: 3 }}>+{chips.length - 3} más</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Detalle del día seleccionado */}
            <aside className="cal-detail">
              <div style={{ background: '#fff', border: '1px solid #D3E7DE', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,128,105,0.06)' }}>
                <div className="flex items-center gap-2" style={{ padding: '12px 14px', borderBottom: '1px solid #E7F1EC' }}>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#054D44' }}>{fechaLarga(sel)}</p>
                  {/* Dos caminos SEPARADOS y a la vista (Lukas, 11-08-2026): antes el único
                      botón abría el dictado y el formulario quedaba escondido detrás de
                      «Prefiero a mano», así que parecía que no existía. */}
                  <button onClick={abrirVoz} title="Dictar por voz"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #00A884', background: '#fff', color: '#008069', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>
                    <Mic size={14} /> Dictar
                  </button>
                  <button onClick={() => openNew(sel)} title="Llenar el formulario a mano"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: '#00A884', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>
                    <Keyboard size={14} /> Formulario
                  </button>
                </div>
                <div style={{ padding: 12, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                  {/* Las salas del horario: una por profesora, con su gente dentro y cada
                      uno con SU hora de salida. Quien avisó que no viene sale en gris y
                      tachado, sin desaparecer: Mary tiene que poder devolverlo con un toque. */}
                  {!loading && salasSel.map(s => {
                    const pc = profeColor(s.profe ?? '')
                    const fuera = s.alumnos.length - s.vienen
                    return (
                      <div key={`sala-${s.profe ?? 'sp'}`} data-sala={s.profe ?? 'sin-profe'}
                        style={{ background: '#fff', border: `1px solid ${pc.bd}`, borderLeft: `3px solid ${pc.color}`, borderRadius: 10, padding: '9px 11px', marginBottom: 8 }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#1F2937' }}>{rangoSala(s.hora, s.horaFin)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, flex: 1 }}>{s.profe ?? 'sin profesora'}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#667781', background: '#F3F9F6', border: '1px solid #D3E7DE', borderRadius: 999, padding: '2px 8px' }}>
                            {s.vienen === 1 ? 'viene 1' : `vienen ${s.vienen}`}{fuera ? ` · ${fuera} no` : ''}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#667781', background: '#F3F9F6', border: '1px solid #D3E7DE', borderRadius: 999, padding: '2px 8px' }}>todas las semanas</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {s.alumnos.map(a => chipInscrito(sel, a, pc.bd))}
                        </div>
                      </div>
                    )
                  })}
                  {/* Las de todas las semanas van primero y ordenadas por hora: es como
                      Mary lee su planilla. Se ven distintas de las clases sueltas para que
                      se note de un vistazo cuáles se repiten solas. */}
                  {!loading && fijasSel.map(f => {
                    const pc = profeColor(f.profe)
                    return (
                      <div key={`fija-${f.id}`} style={{ background: '#fff', border: `1px dashed ${pc.color}`, borderLeft: `3px double ${pc.color}`, borderRadius: 10, padding: '9px 11px', marginBottom: 8 }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#1F2937' }}>{rango(f)}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, flex: 1 }}>{f.profe}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#667781', background: '#F3F9F6', border: '1px solid #D3E7DE', borderRadius: 999, padding: '2px 8px' }}>todas las semanas</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {f.alumnos.length === 0 ? <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sin alumnos</span>
                            : f.alumnos.map(a => chipAlumno(sel, a, pc.bd))}
                        </div>
                        {f.cuposPrueba > 0 && (
                          <p style={{ fontSize: 11, color: '#008069', fontWeight: 700, marginTop: 6 }}>
                            {f.cuposPrueba === 1 ? 'Queda 1 cupo' : `Quedan ${f.cuposPrueba} cupos`} para clase de prueba
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {/* Pagos que vuelven cada mes y recordatorios: van con otro color para que
                      no se confundan con una clase de un vistazo. */}
                  {!loading && pagosSel.map(p => (
                    <div key={`pago-${p.id}`} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderLeft: '3px solid #F59E0B', borderRadius: 10, padding: '9px 11px', marginBottom: 8 }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#92400E' }}>{pesos(p.monto)}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', flex: 1 }}>{ETIQUETA_PAGO[p.tipo] ?? p.tipo}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 999, padding: '2px 8px' }}>todos los meses</span>
                        <button onClick={() => borrarExtra(`/api/pagos-fijos/${p.id}`, '¿Borrar este pago? Deja de aparecer todos los meses.')} title="Borrar"
                          style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#B45309' }}><Trash2 size={13} /></button>
                      </div>
                      {p.descripcion && <p style={{ fontSize: 12, color: '#78350F', marginTop: 4 }}>{p.descripcion}</p>}
                    </div>
                  ))}
                  {!loading && recordatoriosSel.map(r => (
                    <div key={`rec-${r.id}`} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderLeft: '3px solid #3B82F6', borderRadius: 10, padding: '9px 11px', marginBottom: 8 }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#1E3A8A' }}>{r.hora ?? '—'}</span>
                        <span style={{ fontSize: 12, color: '#1E40AF', flex: 1, textDecoration: r.hecho ? 'line-through' : 'none' }}>{r.texto}</span>
                        <button onClick={() => toggleHecho(r)} title={r.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}
                          style={{ minWidth: 44, minHeight: 32, border: 'none', background: 'transparent', cursor: 'pointer', color: '#1D4ED8', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}>
                          {r.hecho ? 'Hecho' : 'Marcar'}
                        </button>
                        <button onClick={() => borrarExtra(`/api/recordatorios/${r.id}`, '¿Borrar este recordatorio?')} title="Borrar"
                          style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#1D4ED8' }}><Trash2 size={13} /></button>
                      </div>
                      {/* "Enviado" SOLO cuando el WhatsApp salió de verdad (enviadoAt).
                          Antes de eso se dice que está en camino, nunca que ya salió:
                          dar por enviado lo que no salió ya costó un incidente. */}
                      <p style={{ fontSize: 10.5, color: '#3B82F6', marginTop: 4 }}>
                        {!r.avisar ? 'Sin aviso'
                          : r.enviadoAt ? 'Te llegó por WhatsApp'
                          : r.outboxId ? 'Mandándolo por WhatsApp…'
                          : 'Te llega por WhatsApp'}
                      </p>
                    </div>
                  ))}
                  {loading ? <p style={{ fontSize: 12, color: '#9AA7AD', textAlign: 'center', padding: '24px 0' }}>Cargando…</p>
                    : eventosSel.length === 0 && fijasSel.length === 0 && salasSel.length === 0 && pagosSel.length === 0 && recordatoriosSel.length === 0 ? <p style={{ fontSize: 12, color: '#8696A0', textAlign: 'center', padding: '24px 0' }}>Sin nada este día.<br />Toca «Agregar» para crear algo.</p>
                    : eventosSel.map(c => {
                      const pc = profeColor(c.profe)
                      return (
                        <div key={c.id} style={{ background: pc.bg, border: `1px solid ${pc.bd}`, borderLeft: `3px solid ${pc.color}`, borderRadius: 10, padding: '9px 11px', marginBottom: 8 }}>
                          <div className="flex items-center gap-2" style={{ marginBottom: 5 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#1F2937' }}>{c.hora || '—'}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pc.color, flex: 1 }}>{c.profe}</span>
                            <button onClick={() => openEdit(c)} title="Editar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#667781' }}><Pencil size={13} /></button>
                            <button onClick={() => del(c)} title="Borrar" style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#667781' }}><Trash2 size={13} /></button>
                          </div>
                          {c.nota && <p style={{ fontSize: 12, color: '#5A1A38', fontWeight: 600, marginBottom: 5 }}>{c.nota}</p>}
                          <div className="flex flex-wrap gap-1">
                            {c.alumnos.length === 0 ? <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sin alumnos</span>
                              : c.alumnos.map(a => chipAlumno(c.fecha ?? sel, etiquetaAlumno(a), pc.bd))}
                          </div>
                        </div>
                      )
                    })}
                  {/* Los que faltaron en el mes que está mirando. Sale del pase de
                      lista de las 21:00 y de lo que ella corrija con el dedo. */}
                  {!loading && faltasMes.length > 0 && (
                    <div style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '9px 11px' }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', marginBottom: 6 }}>Faltaron este mes</p>
                      {faltasMes.map(f => (
                        <div key={f.alumno} className="flex items-center gap-2" style={{ marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: '#7F1D1D', fontWeight: 700, flex: 1 }}>{f.alumno}</span>
                          <span style={{ fontSize: 10.5, color: '#B91C1C' }}>{f.dias.map(d => Number(d.slice(8, 10))).join(', ')}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#EF4444', borderRadius: 999, padding: '1px 7px' }}>{f.dias.length}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Menú de un alumno: vino, faltó, avisó que no viene, o sin marcar.
          Los cuatro estados a la vista y con su nombre completo: antes había que
          adivinar cuál venía después de cada toque. */}
      {menu && (() => {
        const a = menu.alumno
        const est = estadoAsis(menu.fecha, menu.nombre)
        const cerrar = () => { setMenu(null); setPasoNoViene(false) }
        const d = new Date(`${menu.fecha}T12:00:00`)
        const soloEsteDia = capital(d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric' }))
        const nombreMes = d.toLocaleDateString('es-CL', { month: 'long' })
        const opcion = (texto: string, sub: string, color: string, fondo: string, onClick: () => void) => (
          <button key={texto} onClick={onClick}
            style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 48, padding: '10px 14px', marginBottom: 8, borderRadius: 10,
              border: `1px solid ${color}33`, background: fondo, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color }}>{texto}</span>
            {sub && <span style={{ display: 'block', fontSize: 11, color: '#667781', marginTop: 2 }}>{sub}</span>}
          </button>
        )
        return (
          <div onClick={cerrar} data-menu-alumno={menu.nombre}
            style={{ position: 'fixed', inset: 0, background: 'rgba(6,77,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 18, width: 340, maxWidth: '100%', boxShadow: '0 20px 50px rgba(6,77,68,0.25)' }}>
              <div className="flex items-center" style={{ marginBottom: 4 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#054D44', flex: 1 }}>{menu.nombre}</p>
                <button onClick={cerrar} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#8696A0', display: 'flex' }}><X size={16} /></button>
              </div>
              <p style={{ fontSize: 12, color: '#667781', marginBottom: 12 }}>{fechaLarga(menu.fecha)}</p>

              {!pasoNoViene ? (
                <>
                  {a && a.estado !== 'normal' && a.ausenciaId
                    ? opcion('Sí viene', a.estado === 'aviso-mes' ? 'quita el aviso de todo el mes' : 'quita el aviso de este día',
                        '#00A884', '#ECFDF5', () => { siViene(a.ausenciaId!); cerrar() })
                    : null}
                  {opcion('Vino', 'estuvo en clase', '#047857', est === 'vino' ? '#ECFDF5' : '#fff',
                    () => { fijarAsis(menu.fecha, menu.nombre, 'vino'); cerrar() })}
                  {opcion('Faltó', 'no vino y no avisó', '#B91C1C', est === 'falto' ? '#FEE2E2' : '#fff',
                    () => { fijarAsis(menu.fecha, menu.nombre, 'falto'); cerrar() })}
                  {a && a.estado === 'normal'
                    ? opcion('Avisó que no viene', 'queda en gris y le toca una clase recuperativa', '#667781', '#F3F4F6',
                        () => setPasoNoViene(true))
                    : null}
                  {est ? opcion('Dejarlo sin marcar', 'como si nadie hubiera dicho nada', '#8696A0', '#fff',
                    () => { fijarAsis(menu.fecha, menu.nombre, null); cerrar() }) : null}
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#054D44', marginBottom: 10 }}>¿No viene solo este día, o en todo {nombreMes}?</p>
                  {opcion(`Solo el ${soloEsteDia}`, 'los otros días sigue viniendo igual', '#054D44', '#F3F9F6',
                    () => { if (a) noViene(a.alumnoId, menu.nombre, menu.fecha, 'dia'); cerrar() })}
                  {opcion(`Todo ${nombreMes}`, `sale del listado de alumnos de ${nombreMes} y vuelve solo el mes siguiente`, '#054D44', '#F3F9F6',
                    () => { if (a) noViene(a.alumnoId, menu.nombre, menu.fecha, 'mes'); cerrar() })}
                  {opcion('Volver', '', '#8696A0', '#fff', () => setPasoNoViene(false))}
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Modal AGENDAR POR VOZ */}
      {showVoz && (
        <div onClick={cerrarVoz} style={{ position: 'fixed', inset: 0, background: 'rgba(6,77,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, width: 420, maxWidth: '100%', boxShadow: '0 20px 50px rgba(6,77,68,0.25)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#054D44' }}>Agendar por voz · {fechaLarga(sel)}</p>
              <button onClick={cerrarVoz} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#8696A0', display: 'flex' }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: '#667781', marginBottom: 14 }}>Toca el micrófono y di la clase. Ej: «clase con Paula el martes a las 4 de la tarde con Sofía y Juan».</p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <button onClick={toggleEscucha} className={listening ? 'pulse-red' : ''}
                style={{ width: 76, height: 76, borderRadius: '50%', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', background: listening ? '#DC2626' : '#00A884', boxShadow: listening ? '0 0 0 6px rgba(220,38,38,0.15)' : '0 6px 18px rgba(0,168,132,0.35)' }}>
                <Mic size={30} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: listening ? '#DC2626' : '#8696A0', textAlign: 'center', marginBottom: 10 }}>{transcribiendo ? 'Transcribiendo…' : listening ? 'Escuchando… toca para detener' : 'Toca el micrófono para hablar'}</p>
            <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={3} placeholder="Aquí aparece lo que dices (puedes corregirlo)…"
              style={{ width: '100%', resize: 'vertical', borderRadius: 10, border: '1px solid #D3E7DE', background: '#F3F9F6', padding: '10px 12px', fontSize: 14, lineHeight: 1.5, color: '#111B21', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={crearPorVoz} disabled={creandoVoz || !transcript.trim()}
              style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 9, border: 'none', background: (creandoVoz || !transcript.trim()) ? '#A7D8CC' : '#00A884', color: '#fff', fontWeight: 700, fontSize: 14, cursor: (creandoVoz || !transcript.trim()) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {creandoVoz ? 'Agendando…' : 'Crear clase'}
            </button>
            <button onClick={() => { cerrarVoz(); openNew(sel) }}
              style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 9, border: '1px solid #D3E7DE', background: '#fff', color: '#667781', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Keyboard size={14} /> Prefiero a mano
            </button>
          </div>
        </div>
      )}

      {/* Modal agregar / editar */}
      {showForm && (
        <div onClick={closeForm} style={{ position: 'fixed', inset: 0, background: 'rgba(6,77,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 20, width: 420, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(6,77,68,0.25)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#054D44' }}>{editId ? 'Editar' : 'Agregar'} {TITULO_TIPO[tipoForm]} · {fechaLarga(form.fecha)}</p>
              <button type="button" onClick={closeForm} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#8696A0', display: 'flex' }}><X size={16} /></button>
            </div>

            {/* Lo primero que elige Mary es QUÉ está agregando. Editando una clase no se
                muestra: ahí el tipo ya está decidido y cambiarlo confundiría. */}
            {!editId && (
              <div className="flex gap-1" style={{ marginBottom: 14, background: '#F3F9F6', border: '1px solid #D3E7DE', borderRadius: 10, padding: 3 }}>
                {(['clase', 'alumno', 'pago', 'recordatorio'] as const).map(t => (
                  <button type="button" key={t} onClick={() => setTipoForm(t)}
                    style={{
                      flex: 1, minHeight: 44, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize',
                      background: tipoForm === t ? '#00A884' : 'transparent',
                      color: tipoForm === t ? '#fff' : '#667781',
                    }}>
                    {t === 'recordatorio' ? 'Recordar' : t}
                  </button>
                ))}
              </div>
            )}

            {tipoForm !== 'clase' ? (
              <FormularioExtras
                tipo={tipoForm}
                fecha={form.fecha}
                horarios={horariosExistentes}
                onClose={closeForm}
                onGuardado={() => load(desde, hasta)}
              />
            ) : (
            <form onSubmit={submitForm}>
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#667781' }}>Profe</label>
                <select value={form.profe} onChange={e => setForm({ ...form, profe: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
                  {PROFES.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ width: 110 }}>
                <label style={{ fontSize: 12, color: '#667781' }}>Hora</label>
                <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13 }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#667781' }}>Título / nota</label>
              <input value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} placeholder="Ej: taller de óleo"
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13 }} />
            </div>

            <label style={{ fontSize: 12, color: '#667781' }}>Alumnos ({form.alumnos.length + form.alumnosExtra.length})</label>
            {form.alumnosExtra.length > 0 && (
              <div className="flex flex-wrap gap-1" style={{ margin: '4px 0' }}>
                {form.alumnosExtra.map((a, k) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#374151', background: '#E7F1EC', border: '1px solid #D3E7DE', borderRadius: 6, padding: '1px 6px' }}>
                    {String(a)}
                    <button type="button" onClick={() => setForm(f => ({ ...f, alumnosExtra: f.alumnosExtra.filter((_, j) => j !== k) }))}
                      style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: '#667781', padding: 0 }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar alumno…"
              style={{ width: '100%', margin: '4px 0 8px', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13 }} />
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #E7F1EC', borderRadius: 8 }}>
              {clientesOrdenados.map(c => {
                const selA = form.alumnos.includes(c.id)
                const esDelDia = c.horario.includes(diaForm)
                return (
                  <button type="button" key={c.id} onClick={() => toggleAlumno(c.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: 'none', borderBottom: '1px solid #F3F9F6', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', background: selA ? '#E7F1EC' : '#fff' }}>
                    <span style={{ width: 15, height: 15, borderRadius: 4, border: '1px solid ' + (selA ? '#00A884' : '#D3E7DE'), background: selA ? '#00A884' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>{selA ? '✓' : ''}</span>
                    <span style={{ flex: 1, color: '#374151' }}>{c.nombre || c.telefono}</span>
                    {esDelDia && <span style={{ fontSize: 10, fontWeight: 700, color: '#00A884', background: '#E7F1EC', borderRadius: 5, padding: '1px 6px' }}>viene {DIA_LABEL[diaForm] ?? diaForm}</span>}
                  </button>
                )
              })}
              {clientesOrdenados.length === 0 && <p style={{ fontSize: 12, color: '#9AA7AD', textAlign: 'center', padding: '14px 0' }}>Sin clientes</p>}
            </div>

            <button type="submit" disabled={guardando} style={{ width: '100%', marginTop: 16, minHeight: 46, padding: '10px', borderRadius: 9, border: 'none', background: '#00A884', color: '#fff', fontWeight: 700, fontSize: 14, cursor: guardando ? 'default' : 'pointer', opacity: guardando ? 0.6 : 1, fontFamily: 'inherit' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
