'use client'

// LA PANTALLA DE FORMULARIOS (Lukas, 08-09-2026).
//
// "que haya una parte, en mi computador, que uno pueda agregar un formulario, que
// sería enviárselo y que le aparezca bonito a la persona, diseñado con este look,
// con un link que puedan responder ese formulario, y tener toda una estructura para
// poder enviarlo de la manera correcta sin que haya ningún problema".
//
// "Sin ningún problema" es lo que ordena esta pantalla: el envío está en CUATRO pasos
// y cada uno tapa un fallo que ya nos costó caro en otro cliente.
//   1. se elige a quién,
//   2. se escribe el mensaje y se ve la vista previa EXACTA,
//   3. se manda una prueba a un teléfono de verdad y se abre el link,
//   4. recién ahí se habilita el envío, que sale a goteo por la cola anti-baneo.

import { useCallback, useEffect, useState } from 'react'
import AppNav from '@/components/AppNav'
import { Plus, X, Trash2, Copy, Check, Send, Eye, ChevronDown, ChevronUp, ClipboardList, AlertTriangle } from 'lucide-react'
import { NOMBRE_TIPO, TIPOS, type Pregunta, type TipoPregunta } from '@/lib/formularios'

type FormularioLista = {
  id: number; slug: string; titulo: string; intro: string; cierre: string
  preguntas: Pregunta[]; activo: boolean; link: string; respuestas: number; enviados: number
}
type Audiencia = { clave: string; nombre: string; candidatos: number }
type Datos = {
  formularios: FormularioLista[]; audiencias: Audiencia[]; plantilla: string
  cierreDefecto: string; conectado: boolean
  stats: { pendientes: number; enviados: number; omitidos: number; enviadosHoy: number }
}

const VERDE = '#00A884'
const TINTA = '#1F2A37'
const GRIS = '#6B7280'

let seq = 0
const idNuevo = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`

const PREGUNTA_VACIA = (): Pregunta => ({ id: idNuevo(), tipo: 'texto-corto', texto: '', obligatoria: true })

export default function PaginaFormularios() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [editando, setEditando] = useState<FormularioLista | 'nuevo' | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'mal'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    const r = await fetch('/api/formularios', { cache: 'no-store' })
    if (r.ok) setDatos(await r.json() as Datos)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <div className="app-shell flex h-screen" style={{ background: '#F7FBF9' }}>
      <AppNav />
      <main className="flex-1 overflow-y-auto" style={{ padding: '28px 32px 60px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <ClipboardList size={26} style={{ color: VERDE }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: TINTA, letterSpacing: '-0.02em' }}>Formularios</h1>
            <div style={{ flex: 1 }} />
            {!editando && (
              <button onClick={() => setEditando('nuevo')} style={botonVerde}>
                <Plus size={17} /> Nuevo formulario
              </button>
            )}
          </header>
          <p style={{ fontSize: 14.5, color: GRIS, marginBottom: 24, lineHeight: 1.6 }}>
            Arma unas preguntas, se las mandas a la gente por WhatsApp con un link y las respuestas
            te llegan acá. El formulario se ve bonito en el teléfono de la persona.
          </p>

          {aviso && (
            <div style={{
              marginBottom: 20, padding: '13px 16px', borderRadius: 11, fontSize: 14.5, fontWeight: 500,
              lineHeight: 1.5,
              background: aviso.tipo === 'ok' ? '#ECFDF5' : '#FEF2F2',
              color: aviso.tipo === 'ok' ? '#047857' : '#B91C1C',
              border: `1px solid ${aviso.tipo === 'ok' ? '#A7F3D0' : '#FECACA'}`,
            }}>{aviso.texto}</div>
          )}

          {!datos && <p style={{ color: GRIS, fontSize: 14 }}>Cargando…</p>}

          {datos && editando && (
            <Editor
              inicial={editando === 'nuevo' ? null : editando}
              cierreDefecto={datos.cierreDefecto}
              onCancelar={() => setEditando(null)}
              onGuardado={(msg) => { setEditando(null); setAviso({ tipo: 'ok', texto: msg }); void cargar() }}
              onError={(msg) => setAviso({ tipo: 'mal', texto: msg })}
            />
          )}

          {datos && !editando && datos.formularios.length === 0 && (
            <div style={{ ...tarjeta, textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>🎨</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: TINTA, marginBottom: 6 }}>Todavía no hay ningún formulario</p>
              <p style={{ fontSize: 14.5, color: GRIS, lineHeight: 1.6 }}>
                Toca &quot;Nuevo formulario&quot; y arma las preguntas que quieras hacerle a la gente.
              </p>
            </div>
          )}

          {datos && !editando && datos.formularios.map((f) => (
            <Tarjeta
              key={f.id} f={f} datos={datos}
              onEditar={() => setEditando(f)}
              onCambio={(msg, mal) => { setAviso({ tipo: mal ? 'mal' : 'ok', texto: msg }); void cargar() }}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

// ── Una tarjeta por formulario ──────────────────────────────────────────────

function Tarjeta({ f, datos, onEditar, onCambio }: {
  f: FormularioLista; datos: Datos
  onEditar: () => void
  onCambio: (msg: string, mal?: boolean) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(f.link)
      setCopiado(true); setTimeout(() => setCopiado(false), 2200)
    } catch { onCambio('No se pudo copiar. Selecciona el link y cópialo a mano.', true) }
  }

  async function borrar() {
    if (!confirm(`¿Borrar "${f.titulo}"? También se borran sus ${f.respuestas} respuestas y no se pueden recuperar.`)) return
    const r = await fetch('/api/formularios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'borrar', id: f.id }),
    })
    onCambio(r.ok ? 'Formulario borrado.' : 'No se pudo borrar.', !r.ok)
  }

  return (
    <div style={{ ...tarjeta, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 17.5, fontWeight: 700, color: TINTA, letterSpacing: '-0.01em' }}>{f.titulo}</h2>
            {!f.activo && <span style={chipGris}>cerrado</span>}
          </div>
          <p style={{ fontSize: 13.5, color: GRIS, marginTop: 5 }}>
            {f.preguntas.length} {f.preguntas.length === 1 ? 'pregunta' : 'preguntas'}
            {' · '}{f.enviados} {f.enviados === 1 ? 'enviado' : 'enviados'}
            {' · '}<b style={{ color: f.respuestas ? '#047857' : GRIS }}>{f.respuestas} {f.respuestas === 1 ? 'respuesta' : 'respuestas'}</b>
          </p>
        </div>
        <button onClick={() => setAbierto(!abierto)} style={botonBlanco}>
          {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {abierto ? 'Cerrar' : 'Enviar'}
        </button>
        <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer" style={{ ...botonBlanco, textDecoration: 'none' }}>
          <Eye size={16} /> Ver
        </a>
        <button onClick={onEditar} style={botonBlanco}>Editar</button>
        <button onClick={borrar} style={{ ...botonBlanco, color: '#B91C1C' }} aria-label="Borrar"><Trash2 size={16} /></button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 12px',
        background: '#F3F9F6', border: '1px solid #E7F1EC', borderRadius: 10,
      }}>
        <span style={{ flex: 1, fontSize: 13, color: '#054D44', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.link}</span>
        <button onClick={copiar} style={{ ...botonBlanco, padding: '6px 10px', fontSize: 12.5 }}>
          {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
        </button>
      </div>

      {abierto && <PanelEnvio f={f} datos={datos} onCambio={onCambio} />}
      {f.respuestas > 0 && <Respuestas formularioId={f.id} />}
    </div>
  )
}

// ── Los 4 pasos del envío ───────────────────────────────────────────────────

function PanelEnvio({ f, datos, onCambio }: {
  f: FormularioLista; datos: Datos; onCambio: (msg: string, mal?: boolean) => void
}) {
  const [audiencia, setAudiencia] = useState('')
  const [plantilla, setPlantilla] = useState(datos.plantilla)
  const [previa, setPrevia] = useState('')
  const [telPrueba, setTelPrueba] = useState('')
  const [probado, setProbado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const post = useCallback(async (body: Record<string, unknown>) => {
    setOcupado(true)
    try {
      const r = await fetch('/api/formularios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      return await r.json() as { ok: boolean; error?: string; mensaje?: string; encolados?: number; repetidos?: number; cancelados?: number }
    } finally { setOcupado(false) }
  }, [])

  useEffect(() => { void (async () => {
    const j = await post({ action: 'previsualizar', id: f.id })
    if (j.ok && j.mensaje) setPrevia(j.mensaje)
  })() }, [f.id, post])

  async function guardarPlantilla() {
    const j = await post({ action: 'plantilla', plantilla })
    if (!j.ok) return onCambio(j.error ?? 'No se pudo guardar el mensaje.', true)
    const p = await post({ action: 'previsualizar', id: f.id })
    if (p.ok && p.mensaje) setPrevia(p.mensaje)
    onCambio('Mensaje guardado.')
  }

  async function mandarPrueba() {
    const j = await post({ action: 'prueba', id: f.id, telefono: telPrueba })
    if (!j.ok) return onCambio(j.error ?? 'No se pudo mandar la prueba.', true)
    setProbado(true)
    onCambio('Prueba encolada. Va a llegar en menos de un minuto: ábrela y revisa que el link funcione antes de mandarlo a todos.')
  }

  async function enviar() {
    const aud = datos.audiencias.find(a => a.clave === audiencia)
    if (!aud) return
    if (!confirm(`Se le va a mandar "${f.titulo}" a ${aud.candidatos} personas (${aud.nombre.toLowerCase()}).\n\nSalen de a uno, con pausas de 40 a 90 segundos y un tope de 35 al día, para no arriesgar el número. ¿Sigo?`)) return
    const j = await post({ action: 'enviar', id: f.id, audiencia })
    if (!j.ok) return onCambio(j.error ?? 'No se pudo enviar.', true)
    const rep = j.repetidos ? ` (${j.repetidos} ya lo tenían y no se repiten)` : ''
    onCambio(`Listo: ${j.encolados} en cola${rep}. Salen de a uno para no arriesgar el número; el último puede tardar unas horas.`)
  }

  async function detener() {
    const j = await post({ action: 'detener' })
    onCambio(j.ok ? `Se cancelaron ${j.cancelados} envíos que estaban en cola.` : 'No se pudo detener.', !j.ok)
  }

  const aud = datos.audiencias.find(a => a.clave === audiencia)

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #E7F1EC' }}>
      {!datos.conectado && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '12px 14px', marginBottom: 16, borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <AlertTriangle size={17} style={{ color: '#B45309', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13.5, color: '#92400E', lineHeight: 1.55 }}>
            WhatsApp está desconectado, así que ahora no sale nada. Conéctalo en la pestaña Conexión y vuelve acá.
          </p>
        </div>
      )}

      <Paso n={1} titulo="¿A quién se lo mandas?">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {datos.audiencias.map(a => (
            <label key={a.clave} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
              background: audiencia === a.clave ? '#E7F1EC' : '#F8FAF9',
              border: `2px solid ${audiencia === a.clave ? VERDE : 'transparent'}`,
            }}>
              <input type="radio" name={`aud-${f.id}`} checked={audiencia === a.clave}
                onChange={() => setAudiencia(a.clave)} style={{ accentColor: VERDE, width: 17, height: 17 }} />
              <span style={{ flex: 1, fontSize: 14.5, color: TINTA }}>{a.nombre}</span>
              <span style={{ fontSize: 13, color: GRIS, fontWeight: 600 }}>{a.candidatos}</span>
            </label>
          ))}
        </div>
      </Paso>

      <Paso n={2} titulo="El mensaje que va con el link">
        <textarea value={plantilla} onChange={e => setPlantilla(e.target.value)} rows={4} style={campoTexto} />
        <p style={{ fontSize: 12.5, color: GRIS, marginTop: 6, lineHeight: 1.5 }}>
          <b>{'{nombre}'}</b> se cambia por el nombre de cada persona y <b>{'{link}'}</b> por su link.
          Si no pones {'{link}'}, se pega solo al final.
        </p>
        <button onClick={guardarPlantilla} disabled={ocupado} style={{ ...botonBlanco, marginTop: 10 }}>Guardar mensaje</button>

        {previa && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: GRIS, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Así le va a llegar</p>
            <div style={{
              background: '#D9FDD3', borderRadius: '10px 10px 10px 2px', padding: '10px 12px',
              fontSize: 14.5, color: '#111B21', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxWidth: 420,
              boxShadow: '0 1px 1px rgba(11,20,26,0.13)', wordBreak: 'break-word',
            }}>{previa}</div>
          </div>
        )}
      </Paso>

      <Paso n={3} titulo="Manda una prueba a tu teléfono y abre el link">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={telPrueba} onChange={e => setTelPrueba(e.target.value)} placeholder="+56 9 1234 5678"
            style={{ ...campoTexto, flex: 1, minWidth: 190, padding: '10px 12px' }} />
          <button onClick={mandarPrueba} disabled={ocupado || !telPrueba.trim() || !datos.conectado} style={botonBlanco}>
            <Send size={15} /> Mandar prueba
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: GRIS, marginTop: 7, lineHeight: 1.5 }}>
          Este paso no se salta: es la única forma de saber que el link se abre bien antes de mandárselo a todos.
        </p>
      </Paso>

      <Paso n={4} titulo="Enviar de verdad" ultimo>
        <button onClick={enviar}
          disabled={ocupado || !aud || !probado || !datos.conectado || aud.candidatos === 0}
          style={{ ...botonVerde, opacity: (!aud || !probado || !datos.conectado || aud.candidatos === 0) ? 0.45 : 1 }}>
          <Send size={16} /> {aud ? `Enviar a ${aud.candidatos} personas` : 'Elige a quién primero'}
        </button>
        {!probado && <p style={{ fontSize: 13, color: '#B45309', marginTop: 9 }}>Falta mandar la prueba del paso 3.</p>}

        <div style={{ marginTop: 16, fontSize: 13, color: GRIS, lineHeight: 1.6 }}>
          En cola ahora: <b>{datos.stats.pendientes}</b> · enviados hoy: <b>{datos.stats.enviadosHoy}</b> de 35.
          {datos.stats.pendientes > 0 && (
            <button onClick={detener} style={{ ...botonBlanco, marginLeft: 10, color: '#B91C1C', padding: '5px 10px', fontSize: 12.5 }}>
              <X size={14} /> Detener lo que falta
            </button>
          )}
        </div>
      </Paso>
    </div>
  )
}

function Paso({ n, titulo, children, ultimo }: { n: number; titulo: string; children: React.ReactNode; ultimo?: boolean }) {
  return (
    <section style={{ marginBottom: ultimo ? 0 : 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{
          width: 23, height: 23, borderRadius: 999, background: VERDE, color: '#fff',
          fontSize: 12.5, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>{n}</span>
        <h3 style={{ fontSize: 15, fontWeight: 650, color: TINTA }}>{titulo}</h3>
      </div>
      <div style={{ paddingLeft: 32 }}>{children}</div>
    </section>
  )
}

// ── Las respuestas ──────────────────────────────────────────────────────────

type Resumen = { id: string; texto: string; tipo: string; cuenta: Record<string, number>; promedio?: number | null; total: number; textos: string[] }

function Respuestas({ formularioId }: { formularioId: number }) {
  const [abierto, setAbierto] = useState(false)
  const [resumen, setResumen] = useState<Resumen[] | null>(null)

  useEffect(() => {
    if (!abierto || resumen) return
    void (async () => {
      const r = await fetch(`/api/formularios/${formularioId}/respuestas`, { cache: 'no-store' })
      if (r.ok) setResumen(((await r.json()) as { resumen: Resumen[] }).resumen)
    })()
  }, [abierto, resumen, formularioId])

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E7F1EC' }}>
      <button onClick={() => setAbierto(!abierto)} style={{ ...botonBlanco, fontSize: 13 }}>
        {abierto ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {abierto ? 'Ocultar respuestas' : 'Ver respuestas'}
      </button>
      {abierto && !resumen && <p style={{ fontSize: 13.5, color: GRIS, marginTop: 10 }}>Cargando…</p>}
      {abierto && resumen && resumen.map(p => (
        <div key={p.id} style={{ marginTop: 16 }}>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: TINTA, marginBottom: 8 }}>{p.texto}</p>
          {Object.keys(p.cuenta).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Object.entries(p.cuenta).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13.5, color: TINTA, minWidth: 130 }}>{k}</span>
                  <div style={{ flex: 1, height: 9, background: '#EEF3F1', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${p.total ? Math.round((v / p.total) * 100) : 0}%`, height: '100%', background: VERDE }} />
                  </div>
                  <span style={{ fontSize: 13, color: GRIS, fontWeight: 600, minWidth: 26, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
              {typeof p.promedio === 'number' && (
                <p style={{ fontSize: 13, color: GRIS, marginTop: 4 }}>Promedio: <b style={{ color: TINTA }}>{p.promedio} de 5</b></p>
              )}
            </div>
          )}
          {p.textos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.textos.map((t, i) => (
                <p key={i} style={{ fontSize: 13.5, color: TINTA, background: '#F8FAF9', borderRadius: 8, padding: '9px 11px', lineHeight: 1.55 }}>{t}</p>
              ))}
            </div>
          )}
          {p.total === 0 && <p style={{ fontSize: 13.5, color: GRIS }}>Nadie ha contestado esta todavía.</p>}
        </div>
      ))}
    </div>
  )
}

// ── El editor ───────────────────────────────────────────────────────────────

function Editor({ inicial, cierreDefecto, onCancelar, onGuardado, onError }: {
  inicial: FormularioLista | null
  cierreDefecto: string
  onCancelar: () => void
  onGuardado: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [intro, setIntro] = useState(inicial?.intro ?? '')
  const [cierre, setCierre] = useState(inicial?.cierre ?? cierreDefecto)
  const [activo, setActivo] = useState(inicial?.activo ?? true)
  const [preguntas, setPreguntas] = useState<Pregunta[]>(inicial?.preguntas?.length ? inicial.preguntas : [PREGUNTA_VACIA()])
  const [guardando, setGuardando] = useState(false)

  const cambiar = (i: number, patch: Partial<Pregunta>) =>
    setPreguntas(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const mover = (i: number, d: -1 | 1) => setPreguntas(ps => {
    const j = i + d
    if (j < 0 || j >= ps.length) return ps
    const c = [...ps]; const t = c[i]; c[i] = c[j]; c[j] = t; return c
  })

  async function guardar() {
    if (!titulo.trim()) return onError('Ponle un título al formulario.')
    if (!preguntas.some(p => p.texto.trim())) return onError('Escribe al menos una pregunta.')
    const sinOpciones = preguntas.find(p =>
      (p.tipo === 'una-opcion' || p.tipo === 'varias-opciones') && (p.opciones ?? []).filter(o => o.trim()).length < 2)
    if (sinOpciones) return onError(`La pregunta "${sinOpciones.texto || 'sin título'}" necesita al menos 2 opciones.`)

    setGuardando(true)
    try {
      const r = await fetch('/api/formularios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: inicial ? 'editar' : 'crear',
          id: inicial?.id,
          formulario: { titulo, intro, cierre, activo, preguntas },
        }),
      })
      const j = await r.json() as { ok: boolean; error?: string }
      if (!j.ok) return onError(j.error ?? 'No se pudo guardar.')
      onGuardado(inicial ? 'Formulario guardado.' : 'Formulario creado. Ya puedes mandarlo.')
    } finally { setGuardando(false) }
  }

  return (
    <div style={{ ...tarjeta, marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: TINTA, marginBottom: 18 }}>
        {inicial ? 'Editar formulario' : 'Nuevo formulario'}
      </h2>

      <Etiqueta>Título (es lo primero que lee la persona)</Etiqueta>
      <input value={titulo} onChange={e => setTitulo(e.target.value)} style={campoTexto}
        placeholder="Ej.: Cómo vamos con las clases de su hijo" />

      <Etiqueta>Texto de arriba (opcional)</Etiqueta>
      <textarea value={intro} onChange={e => setIntro(e.target.value)} rows={2} style={campoTexto}
        placeholder="Son 5 preguntitas cortas, no toma más de 2 minutos." />

      <Etiqueta>Lo que ve al terminar</Etiqueta>
      <input value={cierre} onChange={e => setCierre(e.target.value)} style={campoTexto} />

      <div style={{ marginTop: 22, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: TINTA }}>Preguntas</h3>
        <span style={{ fontSize: 13, color: GRIS }}>{preguntas.length}</span>
      </div>

      {preguntas.map((p, i) => (
        <div key={p.id} style={{ background: '#F8FAF9', borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: GRIS, minWidth: 18 }}>{i + 1}.</span>
            <input value={p.texto} onChange={e => cambiar(i, { texto: e.target.value })}
              placeholder="Escribe la pregunta" style={{ ...campoTexto, marginTop: 0, flex: 1 }} />
            <button onClick={() => mover(i, -1)} disabled={i === 0} style={botonMini} aria-label="Subir"><ChevronUp size={15} /></button>
            <button onClick={() => mover(i, 1)} disabled={i === preguntas.length - 1} style={botonMini} aria-label="Bajar"><ChevronDown size={15} /></button>
            <button onClick={() => setPreguntas(ps => ps.filter((_, j) => j !== i))} style={{ ...botonMini, color: '#B91C1C' }} aria-label="Quitar"><X size={15} /></button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 26 }}>
            <select value={p.tipo} onChange={e => {
              const tipo = e.target.value as TipoPregunta
              const necesita = tipo === 'una-opcion' || tipo === 'varias-opciones'
              cambiar(i, { tipo, opciones: necesita ? (p.opciones?.length ? p.opciones : ['', '']) : undefined })
            }} style={{ ...campoTexto, marginTop: 0, width: 'auto', padding: '8px 10px', fontSize: 13.5 }}>
              {TIPOS.map(t => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: GRIS, cursor: 'pointer' }}>
              <input type="checkbox" checked={p.obligatoria} onChange={e => cambiar(i, { obligatoria: e.target.checked })}
                style={{ accentColor: VERDE, width: 16, height: 16 }} />
              Obligatoria
            </label>
          </div>

          {(p.tipo === 'una-opcion' || p.tipo === 'varias-opciones') && (
            <div style={{ paddingLeft: 26, marginTop: 10 }}>
              {(p.opciones ?? []).map((o, k) => (
                <div key={k} style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
                  <input value={o} placeholder={`Opción ${k + 1}`}
                    onChange={e => cambiar(i, { opciones: (p.opciones ?? []).map((x, m) => (m === k ? e.target.value : x)) })}
                    style={{ ...campoTexto, marginTop: 0, flex: 1, padding: '8px 11px', fontSize: 14 }} />
                  <button onClick={() => cambiar(i, { opciones: (p.opciones ?? []).filter((_, m) => m !== k) })}
                    style={botonMini} aria-label="Quitar opción"><X size={14} /></button>
                </div>
              ))}
              <button onClick={() => cambiar(i, { opciones: [...(p.opciones ?? []), ''] })}
                style={{ ...botonBlanco, padding: '6px 10px', fontSize: 12.5 }}><Plus size={14} /> Añadir opción</button>
            </div>
          )}
        </div>
      ))}

      <button onClick={() => setPreguntas(ps => [...ps, PREGUNTA_VACIA()])} style={botonBlanco}>
        <Plus size={16} /> Añadir pregunta
      </button>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px solid #E7F1EC' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: GRIS, cursor: 'pointer' }}>
          <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} style={{ accentColor: VERDE, width: 16, height: 16 }} />
          Abierto (si lo cierras, el link deja de recibir respuestas)
        </label>
        <div style={{ flex: 1 }} />
        <button onClick={onCancelar} style={botonBlanco}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} style={botonVerde}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, fontWeight: 600, color: GRIS, marginTop: 16, marginBottom: 6 }}>{children}</p>
}

// ── Estilos compartidos ─────────────────────────────────────────────────────

const tarjeta: React.CSSProperties = {
  background: '#fff', border: '1px solid #E7F1EC', borderRadius: 14, padding: 20,
  boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
}
const botonVerde: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', fontSize: 14,
  fontWeight: 600, color: '#fff', background: VERDE, border: 'none', borderRadius: 10,
  cursor: 'pointer', fontFamily: 'inherit',
}
const botonBlanco: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', fontSize: 13.5,
  fontWeight: 550, color: TINTA, background: '#fff', border: '1px solid #D3E7DE',
  borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
}
const botonMini: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
  color: GRIS, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
  cursor: 'pointer', flexShrink: 0,
}
const campoTexto: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14.5, color: TINTA, fontFamily: 'inherit',
  background: '#fff', border: '1px solid #D3E7DE', borderRadius: 9, outline: 'none',
  marginTop: 0, lineHeight: 1.5,
}
const chipGris: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 700, color: '#6B7280', background: '#F3F4F6',
  padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em',
}
