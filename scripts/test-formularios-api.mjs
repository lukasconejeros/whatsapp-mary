// FORMULARIOS por HTTP: la API del panel y, sobre todo, LA PARTE PÚBLICA.
//
// Lo que de verdad importa acá y no se puede probar sin levantar la app:
//   · que /f/<slug> y /api/f/<slug> se abran SIN login (si no, nadie puede responder), y
//   · que el resto del panel siga cerrado (que abrir la puerta del formulario no haya
//     abierto de paso la de los chats de las clientas).
// Esa pareja es el riesgo real del encargo: se toca el middleware, que es lo único que
// separa los datos de Mary de internet.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:formularios-api

import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''

let pass = 0, fail = 0
const ok = (c, m, extra = '') => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m} ${extra}`); fail++ } }

const browser = await chromium.launch()
// DOS contextos: uno con la sesión de Mary y otro ANÓNIMO, como el teléfono de una
// apoderada que abre el link. Sin el segundo, "es público" no queda probado: el
// primero pasaría igual llevando la cookie puesta.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const anon = await browser.newContext({ viewport: { width: 390, height: 844 } })

const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  await browser.close(); process.exit(2)
}

const TITULO = 'ZZTest formulario api'
let id = null, slug = null

console.log('\n🧪 TEST formularios (API + parte pública)\n')

const post = (body) => ctx.request.post(`${BASE}/api/formularios`, { data: body })

try {
  console.log('El panel')
  const r0 = await ctx.request.get(`${BASE}/api/formularios`)
  const d0 = await r0.json()
  ok(r0.ok() && d0.ok && Array.isArray(d0.formularios), 'la API lista los formularios', String(r0.status()))
  ok(Array.isArray(d0.audiencias) && d0.audiencias.length === 3, 'trae las 3 audiencias a las que se puede mandar')
  ok(d0.audiencias.every(a => typeof a.candidatos === 'number'), 'y cuánta gente hay en cada una')
  ok(typeof d0.plantilla === 'string' && d0.plantilla.length > 20, 'y la plantilla del mensaje')

  const vacio = await post({ action: 'crear', formulario: { titulo: '', preguntas: [] } })
  ok(vacio.status() === 400, 'un formulario sin título ni preguntas se rechaza', String(vacio.status()))

  const cr = await post({ action: 'crear', formulario: {
    titulo: TITULO, intro: 'Son 3 preguntitas', cierre: '¡Gracias!',
    preguntas: [
      { id: 'nombre', tipo: 'texto-corto', texto: '¿Cómo se llama?', obligatoria: true },
      { id: 'plan', tipo: 'una-opcion', texto: '¿Qué taller le interesa?', opciones: ['Acuarela', 'Artes'], obligatoria: true },
      { id: 'nota', tipo: 'escala', texto: 'Del 1 al 5', obligatoria: false },
    ],
  } })
  const dcr = await cr.json()
  ok(cr.ok() && dcr.ok && dcr.id > 0, 'se crea el formulario', String(cr.status()))
  id = dcr.id; slug = dcr.slug
  ok(typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug), `el link sale limpio (/f/${slug})`)
  ok(typeof dcr.link === 'string' && dcr.link.includes(`/f/${slug}`), 'y la API devuelve el link entero para copiarlo')

  const prev = await post({ action: 'previsualizar', id })
  const dprev = await prev.json()
  ok(prev.ok() && dprev.mensaje.includes(`/f/${slug}`), 'la vista previa del WhatsApp trae el link de verdad')
  ok(!dprev.mensaje.includes('{link}') && !dprev.mensaje.includes('{nombre}'), 'y sin huecos sin rellenar')

  // ── Lo público, desde un navegador SIN sesión ────────────────────────────
  console.log('\nLa parte pública (sin login, como el teléfono de una apoderada)')
  const pub = await anon.request.get(`${BASE}/api/f/${slug}`)
  const dpub = await pub.json()
  ok(pub.ok() && dpub.ok, 'se puede LEER el formulario sin haber entrado al panel', String(pub.status()))
  ok(dpub.formulario.preguntas.length === 3, 'y vienen las 3 preguntas')
  ok(!JSON.stringify(dpub).includes('telefono'), 'la respuesta pública no filtra ningún teléfono')

  const pagina = await anon.request.get(`${BASE}/f/${slug}`)
  const html = await pagina.text()
  ok(pagina.ok(), 'la PÁGINA del formulario se abre sin login', String(pagina.status()))
  ok(html.includes('¿Cómo se llama?'), 'y trae las preguntas ya pintadas (se abre de una, con mala señal)')

  // El candado que hay que comprobar sí o sí después de tocar el middleware.
  const chats = await anon.request.get(`${BASE}/api/conversations`, { maxRedirects: 0 })
  ok(chats.status() === 401 || chats.status() === 307 || chats.status() === 302,
    'y el RESTO del panel sigue cerrado sin sesión', String(chats.status()))
  const inbox = await anon.request.get(`${BASE}/inbox`, { maxRedirects: 0 })
  ok([302, 307].includes(inbox.status()), 'la pantalla de chats sigue mandando al login', String(inbox.status()))

  // ── Responder ────────────────────────────────────────────────────────────
  console.log('\nResponder')
  const malo = await anon.request.post(`${BASE}/api/f/${slug}`, { data: { respuestas: {} } })
  const dmalo = await malo.json()
  ok(malo.status() === 400 && dmalo.errores.nombre && dmalo.errores.plan,
    'un envío vacío se rechaza y dice QUÉ falta, pregunta por pregunta')

  const inventada = await anon.request.post(`${BASE}/api/f/${slug}`, { data: { respuestas: { nombre: 'Ana', plan: 'Premium' } } })
  ok(inventada.status() === 400, 'una opción que no está en la lista se rechaza en el servidor', String(inventada.status()))

  const bien = await anon.request.post(`${BASE}/api/f/${slug}`, { data: { respuestas: { nombre: 'Ana', plan: 'Acuarela', nota: 5 } } })
  ok(bien.ok(), 'una respuesta completa se guarda', String(bien.status()))

  const resp = await ctx.request.get(`${BASE}/api/formularios/${id}/respuestas`)
  const dresp = await resp.json()
  ok(resp.ok() && dresp.respuestas.length === 1, 'y Mary la ve en el panel')
  const rPlan = dresp.resumen.find(x => x.id === 'plan')
  ok(rPlan && rPlan.cuenta.Acuarela === 1, 'el resumen cuenta cuántos eligieron cada opción')
  const rNota = dresp.resumen.find(x => x.id === 'nota')
  ok(rNota && rNota.promedio === 5, 'y saca el promedio de las puntuaciones')

  // ── Cerrado ──────────────────────────────────────────────────────────────
  console.log('\nCuando Mary lo cierra')
  await post({ action: 'editar', id, formulario: {
    titulo: TITULO, preguntas: [{ id: 'nombre', tipo: 'texto-corto', texto: '¿Cómo se llama?', obligatoria: true }], activo: false,
  } })
  const cerrado = await anon.request.get(`${BASE}/api/f/${slug}`)
  ok(cerrado.status() === 404, 'el link deja de entregar el formulario', String(cerrado.status()))
  const cerradoPost = await anon.request.post(`${BASE}/api/f/${slug}`, { data: { respuestas: { nombre: 'Tarde' } } })
  ok(cerradoPost.status() === 404, 'y deja de aceptar respuestas', String(cerradoPost.status()))
  const paginaCerrada = await anon.request.get(`${BASE}/f/${slug}`)
  ok(paginaCerrada.ok() && (await paginaCerrada.text()).includes('cerrado'),
    'y quien lo abra ve "está cerrado", no un error')

  const noExiste = await anon.request.get(`${BASE}/f/no-existe-este-formulario`)
  ok(noExiste.ok(), 'un link inventado tampoco revienta: enseña la misma pantalla amable', String(noExiste.status()))
} finally {
  if (id) await post({ action: 'borrar', id })
  await browser.close()
}

console.log(`\n${fail === 0 ? '🎉' : '💥'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
