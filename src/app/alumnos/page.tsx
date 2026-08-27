'use client'

// La pestaña ALUMNOS: el CRM de Mary (Lukas, 26-08-2026).
//
// "un CRM aparte, pestaña propia a la izquierda, una tarjeta por alumno, ordenado por
// mes, que no sea plano, en correlación con el calendario".
//
// Por eso: las tarjetas se agrupan por el día en que viene cada uno (se lee igual que
// el calendario), el mes de arriba manda sobre las faltas que se ven abajo, y las
// dudas que dejó la planilla del Excel salen en amarillo hasta que Mary las resuelva.

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import { DIA_LABEL, DIAS, PROFE_NOMBRES, profeColor } from '@/lib/calendario'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Check, Phone, AlertTriangle, Search, Pencil } from 'lucide-react'

type Inscripcion = { id: number; alumnoId: number; dia: string | null; hora: string; horaFin: string | null; profe: string | null; activa: boolean }
type Ficha = {
  id: number; nombre: string; apoderado: string | null; telefono: string | null
  mensualidad: number; notas: string | null; revisar: string | null
  inscripciones: Inscripcion[]; faltas: string[]; vino: number
  // El botón "no viene" del calendario (Lukas, 26-08-2026).
  avisadas: string[]          // los días de ESTE mes que avisó que no venía
  recuperativas: number       // faltas + días avisados: a cuántas clases puede optar
  noVieneEsteMes: boolean     // "que se salga del CRM solo ese mes"
  ausenciaMesId: number | null
  motivoMes: string | null
  // La mensualidad de ESE mes (paso 4). Quien avisó que no viene sale 'no_cobra'.
  pago: Pago
}
type Pago = {
  estado: 'pagado' | 'parcial' | 'pendiente' | 'atrasado' | 'no_cobra' | 'sin_monto'
  monto: number; pagado: number; falta: number; fecha: string | null
  comprobanteId: number | null; ingresoId: number | null; nota: string | null
}

// Cómo se ve cada estado en la tarjeta. 'no_cobra' y 'sin_monto' no pintan nada:
// ya se dicen solos en otra parte de la tarjeta y repetirlos ensucia.
const PAGO_CHIP: Record<string, { texto: (p: Pago) => string; color: string; bg: string }> = {
  pagado:   { texto: p => `pagó ${pesos(p.pagado)}`,                         color: '#047857', bg: '#ECFDF5' },
  parcial:  { texto: p => `abonó ${pesos(p.pagado)}, falta ${pesos(p.falta)}`, color: '#B45309', bg: '#FEF3C7' },
  atrasado: { texto: p => `debe ${pesos(p.falta)}`,                          color: '#B91C1C', bg: '#FEE2E2' },
  pendiente:{ texto: p => `por pagar ${pesos(p.falta)}`,                     color: '#667781', bg: '#F3F4F6' },
}

const pesos = (n: number) => `$${n.toLocaleString('es-CL')}`
const DIA_CORTO: Record<string, string> = { Lunes: 'Lun', Martes: 'Mar', Miercoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sabado: 'Sáb', Domingo: 'Dom' }
const SIN_DIA = 'Sin día asignado'

function mesLargo(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  const s = new Date(a, m - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function mesMas(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function mesDeHoy(): string {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
}
/** '2026-08-03' → '3', para leer "faltó el 3 y el 10" de un vistazo. */
const diaDelMes = (f: string) => String(Number(f.slice(8, 10)))

export default function AlumnosPage() {
  const [mes, setMes] = useState(mesDeHoy)
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroDia, setFiltroDia] = useState('Todos')
  const [abierta, setAbierta] = useState<Ficha | null>(null)
  const [nueva, setNueva] = useState(false)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/alumnos?mes=${m}`, { cache: 'no-store' })
      const d = await r.json() as { ok: boolean; alumnos?: Ficha[] }
      if (d.ok && d.alumnos) setFichas(d.alumnos)
    } catch { /* se queda con lo que había */ }
    setLoading(false)
  }, [])

  useEffect(() => { load(mes) }, [mes, load])

  const texto = busca.trim().toLowerCase()
  const visibles = fichas.filter(f => {
    if (texto && !f.nombre.toLowerCase().includes(texto) && !(f.apoderado ?? '').toLowerCase().includes(texto)) return false
    if (filtroDia === 'Todos') return true
    if (filtroDia === SIN_DIA) return f.inscripciones.every(i => !i.dia)
    return f.inscripciones.some(i => i.dia === filtroDia)
  })

  // Los que avisaron que no vienen en TODO el mes salen del listado normal y se
  // juntan abajo ("que se salga del CRM solo ese mes"). No desaparecen: desde ahí
  // Mary los devuelve con un toque, que si no el aviso sería un viaje sin vuelta.
  const fueraDelMes = visibles.filter(f => f.noVieneEsteMes)
  const activos = visibles.filter(f => !f.noVieneEsteMes)

  // Agrupadas por el día en que vienen: es lo que hace que no se lea como una lista plana.
  const grupos: { dia: string; fichas: Ficha[] }[] = []
  for (const dia of [...DIAS, SIN_DIA]) {
    const dentro = activos.filter(f => dia === SIN_DIA
      ? f.inscripciones.length > 0 && f.inscripciones.every(i => !i.dia)
      : f.inscripciones.some(i => i.dia === dia))
    if (dentro.length) grupos.push({ dia, fichas: dentro })
  }
  const sueltos = activos.filter(f => f.inscripciones.length === 0)
  if (sueltos.length) grupos.push({ dia: 'Todavía sin horario', fichas: sueltos })

  // Arriba va UN solo número: cuántos alumnos hay este mes. Lo demás (faltas, teléfono,
  // pagos, mensualidad) vive dentro de cada tarjeta, que es donde Mary lo necesita.
  const vienenEsteMes = fichas.filter(f => !f.noVieneEsteMes).length

  // "Sí viene": borra el aviso del mes y el alumno vuelve al listado.
  async function siViene(ausenciaId: number) {
    await fetch(`/api/ausencias/${ausenciaId}`, { method: 'DELETE' })
    await load(mes)
  }

  async function guardar(id: number, cambios: Partial<Ficha>) {
    await fetch(`/api/alumnos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
    })
    await load(mes)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        <header className="flex items-center gap-3 shrink-0" style={{ minHeight: 48, padding: '6px 20px', background: '#FFFFFF', borderBottom: '1px solid #D3E7DE', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#054D44' }}>Alumnos</span>
          <div className="flex items-center gap-1" data-mes={mes}>
            <button onClick={() => setMes(m => mesMas(m, -1))} title="Mes anterior" style={btnIcono}><ChevronLeft size={15} /></button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#054D44', minWidth: 130, textAlign: 'center' }}>{mesLargo(mes)}</span>
            <button onClick={() => setMes(m => mesMas(m, 1))} title="Mes siguiente" style={btnIcono}><ChevronRight size={15} /></button>
            {mes !== mesDeHoy() && <button onClick={() => setMes(mesDeHoy())} style={btnTexto}>Este mes</button>}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2" style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 9, color: '#8696A0' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar alumno o apoderado"
              style={{ border: '1px solid #D3E7DE', borderRadius: 999, padding: '6px 12px 6px 28px', fontSize: 12, fontFamily: 'inherit', color: '#054D44', width: 220, outline: 'none' }} />
          </div>
          <button onClick={() => setNueva(true)} style={{ ...btnTexto, background: '#00A884', color: '#fff', border: '1px solid #00A884', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={14} /> Alumno nuevo
          </button>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px 40px' }}>

          {/* Un solo número arriba: cuántos alumnos hay. Nada más. */}
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
            <Resumen n={vienenEsteMes} label={`alumnos en ${mesLargo(mes).split(' ')[0].toLowerCase()}`} color="#00A884" />
          </div>

          {/* Filtro por día: el mismo orden del calendario */}
          <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
            {['Todos', ...DIAS, SIN_DIA].map(d => {
              const activo = filtroDia === d
              return (
                <button key={d} onClick={() => setFiltroDia(d)}
                  style={{ padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${activo ? '#054D44' : '#D3E7DE'}`, background: activo ? '#054D44' : '#fff', color: activo ? '#fff' : '#667781' }}>
                  {d === 'Todos' || d === SIN_DIA ? d : DIA_LABEL[d]}
                </button>
              )
            })}
          </div>

          {loading && <p style={{ fontSize: 13, color: '#8696A0' }}>Cargando…</p>}
          {!loading && visibles.length === 0 && (
            <p style={{ fontSize: 13, color: '#8696A0' }}>No hay alumnos que coincidan. Prueba con otro día o borra la búsqueda.</p>
          )}

          {grupos.map(g => (
            <section key={g.dia} style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA7AD', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {g.dia === SIN_DIA || g.dia === 'Todavía sin horario' ? g.dia : DIA_LABEL[g.dia]} · {g.fichas.length}
              </p>
              {/* alignItems 'start': si no, las tarjetas de una fila se estiran a la más
                  alta (la que trae aviso amarillo) y la cuadrícula se ve desalineada. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 12, alignItems: 'start' }}>
                {g.fichas.map(f => <Tarjeta key={`${g.dia}-${f.id}`} f={f} onClick={() => setAbierta(f)} />)}
              </div>
            </section>
          ))}

          {/* Los que este mes no vienen. Van al final, en gris, y con el botón para
              devolverlos: el aviso tiene que poder deshacerse igual de fácil. */}
          {!loading && fueraDelMes.length > 0 && (
            <section data-fuera-del-mes style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9AA7AD', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                No vienen en {mesLargo(mes).split(' ')[0].toLowerCase()} · {fueraDelMes.length}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 12, alignItems: 'start' }}>
                {fueraDelMes.map(f => (
                  <div key={`fuera-${f.id}`} style={{ border: '1px solid #E5E7EB', borderRadius: 14, background: '#F9FAFB', padding: '12px 14px' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#667781', textDecoration: 'line-through' }}>{f.nombre}</p>
                    <p style={{ fontSize: 11, color: '#8696A0', marginTop: 4 }}>
                      {f.motivoMes ? f.motivoMes : 'avisó que no viene este mes'} · vuelve solo el mes que viene
                    </p>
                    <div className="flex" style={{ gap: 7, marginTop: 10 }}>
                      <button onClick={() => f.ausenciaMesId && siViene(f.ausenciaMesId)}
                        style={{ ...btnTexto, borderColor: '#00A884', color: '#047857' }}>Sí viene</button>
                      <button onClick={() => setAbierta(f)} style={btnTexto}>Ver ficha</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Dos maneras de terminar, y no son la misma:
          · onGuardado  cierra la ficha (el botón Guardar de abajo, dar de baja…),
          · onRefrescar deja la ficha ABIERTA y solo vuelve a leer los datos.
          Lo segundo es para corregir los días de clase: si al arreglar una hora se
          cerrara todo, Mary tendría que volver a abrir la ficha por cada día. */}
      {abierta && (
        <Editor
          ficha={fichas.find(f => f.id === abierta.id) ?? abierta}
          mes={mes}
          onCerrar={() => setAbierta(null)}
          onGuardado={() => { setAbierta(null); load(mes) }}
          onRefrescar={() => load(mes)}
          guardar={guardar}
        />
      )}
      {nueva && <Alta onCerrar={() => setNueva(false)} onCreado={() => { setNueva(false); load(mes) }} />}
    </div>
  )
}

const btnIcono: React.CSSProperties = { display: 'flex', border: '1px solid #D3E7DE', background: '#fff', borderRadius: 8, padding: 5, cursor: 'pointer', color: '#008069' }
const btnTexto: React.CSSProperties = { border: '1px solid #D3E7DE', background: '#fff', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', color: '#667781', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }

function Resumen({ n, label, color }: { n: number | string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, border: '1px solid #D3E7DE', borderRadius: 12, padding: '8px 14px', background: '#fff' }}>
      <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 12, color: '#667781' }}>{label}</span>
    </div>
  )
}

function Tarjeta({ f, onClick }: { f: Ficha; onClick: () => void }) {
  return (
    <button data-alumno={f.id} onClick={onClick}
      style={{ textAlign: 'left', border: '1px solid #D3E7DE', borderRadius: 14, background: '#fff', padding: 0, cursor: 'pointer', fontFamily: 'inherit', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,128,105,0.06)' }}>
      {/* TARJETA COMPACTA (Lukas, 27-08-2026): "fuera el horario y la plata de la
          tarjeta". El horario y la mensualidad no se pierden — se ven, y ahora se
          editan, al abrir la ficha. Aquí se queda solo lo que Mary necesita de un
          vistazo recorriendo el listado: quién es, si falta algo por hacer con él,
          y el aviso amarillo si la planilla dejó una duda. */}
      <div style={{ padding: '11px 13px' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#054D44', lineHeight: 1.2 }}>{f.nombre}</p>

        <div className="flex items-center" style={{ gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
          {f.faltas.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', borderRadius: 999, padding: '2px 8px' }}>
              {f.faltas.length === 1 ? '1 falta' : `${f.faltas.length} faltas`}
            </span>
          )}
          {f.recuperativas > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', borderRadius: 999, padding: '2px 8px' }}>
              {f.recuperativas === 1 ? '1 recuperativa' : `${f.recuperativas} recuperativas`}
            </span>
          )}
          {!f.telefono && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#667781', background: '#F3F4F6', borderRadius: 999, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Phone size={10} style={{ color: '#C7D3D0' }} /> sin teléfono
            </span>
          )}
        </div>
      </div>

      {f.revisar && (
        <div data-revisar style={{ background: '#FFFBEB', borderTop: '1px solid #FDE68A', padding: '8px 14px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertTriangle size={13} style={{ color: '#D97706', marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#92400E', lineHeight: 1.35 }}>{f.revisar}</span>
        </div>
      )}
    </button>
  )
}

function Editor({ ficha, mes, onCerrar, onGuardado, onRefrescar, guardar }: {
  ficha: Ficha; mes: string; onCerrar: () => void; onGuardado: () => void
  onRefrescar: () => void
  guardar: (id: number, cambios: Partial<Ficha>) => Promise<void>
}) {
  const [nombre, setNombre] = useState(ficha.nombre)
  const [apoderado, setApoderado] = useState(ficha.apoderado ?? '')
  const [telefono, setTelefono] = useState(ficha.telefono ?? '')
  const [mensualidad, setMensualidad] = useState(String(ficha.mensualidad || ''))
  const [notas, setNotas] = useState(ficha.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  // Lo que se va a marcar como pagado: viene puesto con lo que se le cobra ese mes,
  // así el caso normal (pagó todo) es un solo toque, y sirve igual para un abono.
  const [cobro, setCobro] = useState(String((ficha.pago.monto || ficha.mensualidad) || ''))
  const [pagando, setPagando] = useState(false)

  const yaPago = ficha.pago.estado === 'pagado' || ficha.pago.estado === 'parcial'

  async function marcarPagado() {
    const monto = parseInt(cobro || '0', 10) || 0
    if (monto <= 0) return
    setPagando(true)
    await fetch(`/api/alumnos/${ficha.id}/pago`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, pagado: monto, fecha: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }) }),
    })
    setPagando(false)
    onGuardado()
  }

  async function borrarPago() {
    setPagando(true)
    await fetch(`/api/alumnos/${ficha.id}/pago?mes=${mes}`, { method: 'DELETE' })
    setPagando(false)
    onGuardado()
  }

  async function aceptar() {
    setGuardando(true)
    await guardar(ficha.id, {
      nombre: nombre.trim(), apoderado: apoderado.trim() || null, telefono: telefono.trim() || null,
      mensualidad: parseInt(mensualidad || '0', 10) || 0, notas: notas.trim() || null,
    })
    onGuardado()
  }

  async function resolverDuda() {
    setGuardando(true)
    await guardar(ficha.id, { revisar: null })
    onGuardado()
  }

  async function darDeBaja() {
    if (!confirm(`¿${ficha.nombre} ya no viene a clases? Sale del listado pero no se pierde su historial.`)) return
    setGuardando(true)
    await fetch(`/api/alumnos/${ficha.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: false }),
    })
    onGuardado()
  }

  async function borrarDia(id: number) {
    if (!confirm('¿Sacarle este día de clase?')) return
    await fetch(`/api/inscripciones/${id}`, { method: 'DELETE' })
    onRefrescar()   // la ficha se queda abierta: casi siempre viene otro día detrás
  }

  return (
    <div onClick={onCerrar} style={fondoModal}>
      <div onClick={e => e.stopPropagation()} style={cajaModal}>
        <div className="flex items-center" style={{ padding: '14px 18px', borderBottom: '1px solid #E7F1EC' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#054D44', flex: 1 }}>{ficha.nombre}</p>
          <button onClick={onCerrar} style={{ ...btnIcono, border: 'none' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto' }}>
          {ficha.revisar && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>{ficha.revisar}</p>
              <button onClick={resolverDuda} disabled={guardando}
                style={{ ...btnTexto, marginTop: 9, display: 'flex', alignItems: 'center', gap: 5, borderColor: '#D97706', color: '#92400E' }}>
                <Check size={13} /> Ya lo confirmé con Mary
              </button>
            </div>
          )}

          <Campo label="Nombre" valor={nombre} set={setNombre} />
          <Campo label="Apoderado" valor={apoderado} set={setApoderado} placeholder="quien paga y contesta el WhatsApp" />
          <Campo label="Teléfono" valor={telefono} set={setTelefono} placeholder="+569…" />
          <Campo label="Mensualidad" valor={mensualidad} set={setMensualidad} placeholder="60000" />
          <Campo label="Notas" valor={notas} set={setNotas} placeholder="lo que haya que recordar" />

          <p style={etiqueta}>Días de clase</p>
          {ficha.inscripciones.map(i => (
            <DiaEditable key={i.id} i={i} onBorrar={() => borrarDia(i.id)} onListo={onRefrescar} />
          ))}
          <NuevoDia alumnoId={ficha.id} onListo={onRefrescar} />

          {(ficha.faltas.length > 0 || ficha.avisadas.length > 0) && (
            <>
              <p style={etiqueta}>Este mes</p>
              {ficha.faltas.length > 0 && (
                <p style={{ fontSize: 12, color: '#B91C1C' }}>
                  Faltó sin avisar {ficha.faltas.length === 1 ? 'el' : 'los días'} {ficha.faltas.map(diaDelMes).join(', ')}.
                </p>
              )}
              {ficha.avisadas.length > 0 && (
                <p style={{ fontSize: 12, color: '#667781', marginTop: 3 }}>
                  Avisó que no venía {ficha.avisadas.length === 1 ? 'el' : 'los días'} {ficha.avisadas.map(diaDelMes).join(', ')}.
                </p>
              )}
              <p style={{ fontSize: 12, color: '#B45309', fontWeight: 700, marginTop: 5 }}>
                Tiene derecho a {ficha.recuperativas === 1 ? 'una clase recuperativa' : `${ficha.recuperativas} clases recuperativas`}.
              </p>
            </>
          )}
          {/* LA MENSUALIDAD DE ESTE MES (paso 4). A quien avisó que no viene no se le
              cobra: en vez del botón se le dice, para que nadie marque un pago que no toca. */}
          <p style={etiqueta}>Mensualidad de {mesLargo(mes).toLowerCase()}</p>
          {ficha.noVieneEsteMes && !yaPago ? (
            <p style={{ fontSize: 12, color: '#667781' }}>Este mes no se le cobra, avisó que no viene.</p>
          ) : ficha.mensualidad <= 0 && !yaPago ? (
            <p style={{ fontSize: 12, color: '#B45309' }}>Primero hay que poner cuánto se le cobra, arriba en Mensualidad.</p>
          ) : (
            <div style={{ background: yaPago ? '#ECFDF5' : '#F7FBF9', border: `1px solid ${yaPago ? '#A7F3D0' : '#D3E7DE'}`, borderRadius: 10, padding: 12 }}>
              {yaPago && (
                <p style={{ fontSize: 12, color: '#047857', fontWeight: 700, marginBottom: 8 }}>
                  {ficha.pago.estado === 'pagado' ? 'Pagó' : 'Abonó'} {pesos(ficha.pago.pagado)}
                  {ficha.pago.fecha ? ` el ${diaDelMes(ficha.pago.fecha)}` : ''}
                  {ficha.pago.falta > 0 ? ` · faltan ${pesos(ficha.pago.falta)}` : ''}
                </p>
              )}
              <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input value={cobro} onChange={e => setCobro(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric" placeholder="60000"
                  style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3E7DE', fontFamily: 'inherit', fontSize: 13 }} />
                <button onClick={marcarPagado} disabled={pagando || !(parseInt(cobro || '0', 10) > 0)}
                  style={{ ...btnTexto, background: '#00A884', color: '#fff', borderColor: '#00A884', opacity: pagando ? 0.6 : 1 }}>
                  {pagando ? 'Guardando…' : yaPago ? 'Corregir el pago' : 'Marcar pagado'}
                </button>
                {yaPago && <button onClick={borrarPago} disabled={pagando} style={{ ...btnTexto, color: '#B91C1C', borderColor: '#FCA5A5' }}>Quitar</button>}
              </div>
            </div>
          )}

          {ficha.noVieneEsteMes && (
            <div style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, marginTop: 14 }}>
              <p style={{ fontSize: 12, color: '#667781' }}>
                Este mes no viene{ficha.motivoMes ? ` (${ficha.motivoMes})` : ''}. Su horario no se toca: vuelve solo el mes siguiente.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center" style={{ gap: 8, padding: '12px 18px', borderTop: '1px solid #E7F1EC' }}>
          <button onClick={darDeBaja} style={{ ...btnTexto, color: '#B91C1C', borderColor: '#FCA5A5' }}>Ya no viene</button>
          <div className="flex-1" />
          <button onClick={onCerrar} style={btnTexto}>Cancelar</button>
          <button onClick={aceptar} disabled={guardando || !nombre.trim()}
            style={{ ...btnTexto, background: '#00A884', color: '#fff', borderColor: '#00A884', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Un día de clase que se puede TOCAR PARA CAMBIARLO (Lukas, 27-08-2026).
//
// Hasta hoy un día solo se podía borrar y volver a crear: para corregir "las 17:30
// eran las 17:00" había que acordarse del resto de la fila y escribirla de nuevo.
// Ahora se toca, se corrige lo que esté malo y se guarda; el borrar sigue donde
// estaba, porque sacarle un día a alguien es otra cosa distinta a corregirlo.
//
// Guarda contra PATCH /api/inscripciones/[id], que ya existía y ya validaba el día,
// el formato de la hora y que la salida vaya después de la entrada. Si la API dice
// que no, el error se muestra aquí y NO se cierra el formulario: si no, Mary creería
// que guardó.
function DiaEditable({ i, onBorrar, onListo }: { i: Inscripcion; onBorrar: () => void; onListo: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [dia, setDia] = useState<string>(i.dia ?? 'Lunes')
  const [hora, setHora] = useState(i.hora)
  const [horaFin, setHoraFin] = useState(i.horaFin ?? '')
  const [profe, setProfe] = useState<string>(i.profe ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardarDia() {
    setError(''); setGuardando(true)
    const r = await fetch(`/api/inscripciones/${i.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia, hora, horaFin: horaFin.trim() || null, profe: profe.trim() || null }),
    })
    const d = await r.json() as { ok: boolean; error?: string }
    setGuardando(false)
    if (!d.ok) { setError(d.error ?? 'No se pudo guardar'); return }
    setAbierto(false)
    onListo()
  }

  // Cerrado: la línea de siempre, pero ahora se puede tocar para corregirla.
  if (!abierto) {
    return (
      <div className="flex items-center" style={{ gap: 8, padding: '7px 0', borderBottom: '1px solid #F2F7F5' }}>
        <button data-dia={i.id} onClick={() => setAbierto(true)}
          style={{ flex: 1, textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#054D44' }}>
          {i.dia ? DIA_LABEL[i.dia] : 'día por confirmar'} · {i.hora}{i.horaFin ? ` a ${i.horaFin}` : ''}{i.profe ? ` · ${i.profe}` : ' · sin profesora'}
        </button>
        <button onClick={() => setAbierto(true)} title="Cambiar este día" style={{ ...btnIcono, border: 'none', color: '#00A884' }}><Pencil size={14} /></button>
        <button onClick={onBorrar} title="Sacar este día" style={{ ...btnIcono, border: 'none', color: '#EF4444' }}><Trash2 size={14} /></button>
      </div>
    )
  }

  return (
    <div data-dia-editando={i.id} style={{ border: '1px solid #D3E7DE', borderRadius: 10, padding: 12, marginBottom: 9 }}>
      <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
        <select value={dia} onChange={e => setDia(e.target.value)} style={input}>
          {DIAS.map(d => <option key={d} value={d}>{DIA_LABEL[d]}</option>)}
        </select>
        <input value={hora} onChange={e => setHora(e.target.value)} placeholder="17:30" style={{ ...input, width: 80 }} />
        <input value={horaFin} onChange={e => setHoraFin(e.target.value)} placeholder="19:30" style={{ ...input, width: 80 }} />
        <select value={profe} onChange={e => setProfe(e.target.value)} style={input}>
          {/* La opción vacía existe porque hay bloques sin profesora sabida (los del
              horario de Mary que quedaron marcados) y no se le inventa una. */}
          <option value="">sin profesora</option>
          {PROFE_NOMBRES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {error && <p style={{ fontSize: 11, color: '#B91C1C', marginTop: 7 }}>{error}</p>}
      <div className="flex" style={{ gap: 7, marginTop: 9 }}>
        <button onClick={guardarDia} disabled={guardando}
          style={{ ...btnTexto, background: '#00A884', color: '#fff', borderColor: '#00A884', opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando…' : 'Guardar el día'}
        </button>
        <button onClick={() => { setAbierto(false); setError('') }} style={btnTexto}>Cancelar</button>
      </div>
    </div>
  )
}

function NuevoDia({ alumnoId, onListo }: { alumnoId: number; onListo: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [dia, setDia] = useState<string>('Lunes')
  const [hora, setHora] = useState('17:30')
  const [horaFin, setHoraFin] = useState('19:30')
  const [profe, setProfe] = useState<string>(PROFE_NOMBRES[0])
  const [error, setError] = useState('')

  async function agregar() {
    setError('')
    const r = await fetch(`/api/alumnos/${alumnoId}/inscripciones`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia, hora, horaFin, profe }),
    })
    const d = await r.json() as { ok: boolean; error?: string }
    if (!d.ok) { setError(d.error ?? 'No se pudo guardar'); return }
    setAbierto(false)
    onListo()
  }

  if (!abierto) return <button onClick={() => setAbierto(true)} style={{ ...btnTexto, marginTop: 9, display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={13} /> Agregar un día</button>

  return (
    <div style={{ border: '1px solid #D3E7DE', borderRadius: 10, padding: 12, marginTop: 9 }}>
      <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
        <select value={dia} onChange={e => setDia(e.target.value)} style={input}>
          {DIAS.map(d => <option key={d} value={d}>{DIA_LABEL[d]}</option>)}
        </select>
        <input value={hora} onChange={e => setHora(e.target.value)} placeholder="17:30" style={{ ...input, width: 80 }} />
        <input value={horaFin} onChange={e => setHoraFin(e.target.value)} placeholder="19:30" style={{ ...input, width: 80 }} />
        <select value={profe} onChange={e => setProfe(e.target.value)} style={input}>
          {PROFE_NOMBRES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {error && <p style={{ fontSize: 11, color: '#B91C1C', marginTop: 7 }}>{error}</p>}
      <div className="flex" style={{ gap: 7, marginTop: 9 }}>
        <button onClick={agregar} style={{ ...btnTexto, background: '#00A884', color: '#fff', borderColor: '#00A884' }}>Agregar</button>
        <button onClick={() => setAbierto(false)} style={btnTexto}>Cancelar</button>
      </div>
    </div>
  )
}

function Alta({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState('')
  const [apoderado, setApoderado] = useState('')
  const [telefono, setTelefono] = useState('')
  const [mensualidad, setMensualidad] = useState('')
  const [error, setError] = useState('')

  async function crear() {
    setError('')
    const r = await fetch('/api/alumnos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), apoderado: apoderado.trim() || null, telefono: telefono.trim() || null, mensualidad: parseInt(mensualidad || '0', 10) || 0 }),
    })
    const d = await r.json() as { ok: boolean; error?: string }
    if (!d.ok) { setError(d.error ?? 'No se pudo guardar'); return }
    onCreado()
  }

  return (
    <div onClick={onCerrar} style={fondoModal}>
      <div onClick={e => e.stopPropagation()} style={{ ...cajaModal, maxWidth: 420 }}>
        <div className="flex items-center" style={{ padding: '14px 18px', borderBottom: '1px solid #E7F1EC' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#054D44', flex: 1 }}>Alumno nuevo</p>
          <button onClick={onCerrar} style={{ ...btnIcono, border: 'none' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 18 }}>
          <Campo label="Nombre" valor={nombre} set={setNombre} placeholder="cómo se llama" />
          <Campo label="Apoderado" valor={apoderado} set={setApoderado} />
          <Campo label="Teléfono" valor={telefono} set={setTelefono} placeholder="+569…" />
          <Campo label="Mensualidad" valor={mensualidad} set={setMensualidad} placeholder="60000" />
          <p style={{ fontSize: 11, color: '#8696A0', marginTop: 4 }}>Los días de clase se le ponen después, abriendo su tarjeta.</p>
          {error && <p style={{ fontSize: 11, color: '#B91C1C', marginTop: 7 }}>{error}</p>}
        </div>
        <div className="flex items-center" style={{ gap: 8, padding: '12px 18px', borderTop: '1px solid #E7F1EC' }}>
          <div className="flex-1" />
          <button onClick={onCerrar} style={btnTexto}>Cancelar</button>
          <button onClick={crear} disabled={!nombre.trim()} style={{ ...btnTexto, background: '#00A884', color: '#fff', borderColor: '#00A884', opacity: nombre.trim() ? 1 : 0.6 }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, valor, set, placeholder }: { label: string; valor: string; set: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <p style={etiqueta}>{label}</p>
      <input value={valor} onChange={e => set(e.target.value)} placeholder={placeholder} style={{ ...input, width: '100%' }} />
    </div>
  )
}

const etiqueta: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#9AA7AD', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 12, marginBottom: 5 }
const input: React.CSSProperties = { border: '1px solid #D3E7DE', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', color: '#054D44', outline: 'none', background: '#fff' }
const fondoModal: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(5,77,68,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }
const cajaModal: React.CSSProperties = { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }
