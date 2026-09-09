// EL FORMULARIO EN LA PANTALLA DEL TELÉFONO, tocado con el dedo de verdad.
//
// El test de la API prueba que los datos entran bien. Esto prueba lo otro, que es lo
// que él pidió: que se VEA bien y que se pueda contestar sin confundirse. Lo que se
// comprueba, y por qué cada cosa:
//   · nada de menú ni barra de la app: "totalmente minimalista", que no parezca el panel;
//   · los botones de opción miden al menos 44 px (si no, con el pulgar no se aciertan);
//   · la página no se va de lado en un teléfono de 390 px (el scroll horizontal es lo
//     que hace que la gente cierre y no responda);
//   · si falta una obligatoria, el error sale BAJO esa pregunta, no arriba del todo;
//   · y al enviar aparece el agradecimiento, no una pantalla en blanco.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:formulario-pantalla

import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''

let pass = 0, fail = 0
const ok = (c, m, extra = '') => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m} ${extra}`); fail++ } }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  await browser.close(); process.exit(2)
}

const TITULO = 'ZZTest formulario pantalla'
let id = null, slug = null

console.log('\n🧪 TEST formulario en pantalla (iPhone 390x844)\n')

try {
  const cr = await ctx.request.post(`${BASE}/api/formularios`, { data: { action: 'crear', formulario: {
    titulo: TITULO, intro: 'Son 3 preguntitas cortas.', cierre: '¡Listo! Gracias por responder',
    preguntas: [
      { id: 'nombre', tipo: 'texto-corto', texto: '¿Cómo se llama?', obligatoria: true },
      { id: 'plan', tipo: 'una-opcion', texto: '¿Qué taller le interesa?', opciones: ['Acuarela', 'Artes', 'Premium'], obligatoria: true },
      { id: 'nota', tipo: 'escala', texto: '¿Qué tan cómoda se sintió?', obligatoria: false },
    ],
  } } })
  const d = await cr.json(); id = d.id; slug = d.slug

  // Teléfono, sin sesión: exactamente lo que abre la apoderada desde WhatsApp.
  const tel = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  })
  const p = await tel.newPage()
  await p.goto(`${BASE}/f/${slug}`, { waitUntil: 'networkidle' })

  console.log('Cómo se ve')
  ok(await p.locator('nav.app-sidebar').count() === 0, 'no aparece el menú de la app: es una pantalla limpia')
  ok(await p.getByText(TITULO).count() > 0, 'se lee el título')
  ok(await p.getByText('Son 3 preguntitas cortas.').count() > 0, 'y el texto de bienvenida')

  const anchoDoc = await p.evaluate(() => document.documentElement.scrollWidth)
  ok(anchoDoc <= 391, 'la página no se va de lado en un teléfono de 390 px', `scrollWidth=${anchoDoc}`)

  const tamPregunta = await p.evaluate(() => {
    const l = [...document.querySelectorAll('label')].find(e => e.textContent?.includes('¿Cómo se llama?'))
    return l ? parseFloat(getComputedStyle(l).fontSize) : 0
  })
  ok(tamPregunta >= 17, 'las preguntas se leen grandes, no a 13 px', `${tamPregunta}px`)

  const opcion = p.getByRole('button', { name: 'Acuarela' })
  const caja = await opcion.boundingBox()
  ok(caja && caja.height >= 44, 'los botones de opción son de tocar con el pulgar (44 px o más)', `alto=${caja?.height}`)

  console.log('\nContestarlo')
  // Enviar sin llenar nada: el error tiene que salir bajo la pregunta que falta.
  await p.getByRole('button', { name: /Enviar respuestas/ }).click()
  await p.waitForTimeout(700)
  ok(await p.getByText('Falta responder esta pregunta').count() >= 2,
    'si faltan dos obligatorias, se marcan las DOS, no solo la primera')
  const yPrimerError = await p.evaluate(() => {
    const e = [...document.querySelectorAll('p')].find(x => x.textContent === 'Falta responder esta pregunta')
    return e ? e.getBoundingClientRect().top : -1
  })
  ok(yPrimerError > 0 && yPrimerError < 844, 'y la pantalla se baja sola hasta la primera que falta', `y=${yPrimerError}`)

  await p.getByPlaceholder('Escriba aquí…').first().fill('Ana Pérez')
  await opcion.click()
  ok(await opcion.getAttribute('aria-pressed') === 'true', 'la opción elegida queda marcada')

  await p.getByRole('button', { name: '4', exact: true }).click()
  await p.getByRole('button', { name: /Enviar respuestas/ }).click()
  await p.waitForTimeout(1400)
  ok(await p.getByText('¡Listo! Gracias por responder').count() > 0, 'al enviar sale el agradecimiento, no una pantalla en blanco')
  ok(await p.getByRole('button', { name: /Enviar respuestas/ }).count() === 0, 'y el formulario desaparece: no se manda dos veces sin querer')

  const resp = await ctx.request.get(`${BASE}/api/formularios/${id}/respuestas`)
  const dr = await resp.json()
  ok(dr.respuestas.length === 1 && dr.respuestas[0].respuestas.nombre === 'Ana Pérez' && dr.respuestas[0].respuestas.nota === 4,
    'y en el panel de Mary aparece lo que escribió, tal cual')

  console.log('\nLa pantalla de Mary (computador)')
  const pc = await ctx.newPage()
  await pc.goto(`${BASE}/formularios`, { waitUntil: 'networkidle' })
  ok(await pc.getByText(TITULO).count() > 0, 'el formulario aparece en su lista')
  ok(await pc.getByRole('link', { name: /Formularios/ }).count() > 0, 'y hay un botón "Formularios" en el menú del computador')
  await pc.getByRole('button', { name: /Enviar/ }).first().click()
  await pc.waitForTimeout(500)
  ok(await pc.getByText('¿A quién se lo mandas?').count() > 0, 'al abrir Enviar salen los pasos, en orden')
  ok(await pc.getByText('Falta mandar la prueba del paso 3.').count() > 0,
    'y no deja mandar a nadie hasta que se haya mandado la prueba')

  console.log('\nEn el teléfono de Mary')
  const marypc = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })
  const pm = await marypc.newPage()
  await pm.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
  const visible = await pm.evaluate(() => {
    const a = document.querySelector('nav.app-sidebar a.app-nav-formularios')
    return a ? getComputedStyle(a).display !== 'none' : false
  })
  ok(!visible, 'el botón Formularios NO sale en la barra del teléfono (se arman en el computador)')
} finally {
  if (id) await ctx.request.post(`${BASE}/api/formularios`, { data: { action: 'borrar', id } })
  await browser.close()
}

console.log(`\n${fail === 0 ? '🎉' : '💥'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
