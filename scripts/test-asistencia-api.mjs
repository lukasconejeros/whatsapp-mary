// La asistencia por HTTP y en la pantalla: que se pueda marcar y desmarcar, que
// no acepte basura, y que el calendario muestre los puntitos sin reventar.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:asistencia-api

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

const F = '2099-03-15'
const ALUMNO = 'Prueba Asistencia'

console.log('\n🧪 TEST asistencia (API + pantalla)\n')

try {
  console.log('La API')
  const vacio = await (await ctx.request.get(`${BASE}/api/asistencia?desde=${F}&hasta=${F}`)).json()
  ok(vacio.ok && Array.isArray(vacio.asistencia) && vacio.asistencia.length === 0, 'un día sin marcar viene vacío', JSON.stringify(vacio))

  const sinRango = await ctx.request.get(`${BASE}/api/asistencia`)
  ok(sinRango.status() === 400, 'sin desde/hasta responde 400', String(sinRango.status()))

  const marcar = await ctx.request.post(`${BASE}/api/asistencia`, { data: { fecha: F, alumno: ALUMNO, estado: 'falto' } })
  ok(marcar.ok(), 'marca que faltó', String(marcar.status()))
  const trasMarcar = await (await ctx.request.get(`${BASE}/api/asistencia?desde=${F}&hasta=${F}`)).json()
  ok(trasMarcar.asistencia[0]?.estado === 'falto', 'y queda guardado', JSON.stringify(trasMarcar.asistencia))
  ok(trasMarcar.asistencia[0]?.fuente === 'panel', 'con constancia de que fue a mano')

  const corregir = await ctx.request.post(`${BASE}/api/asistencia`, { data: { fecha: F, alumno: ALUMNO, estado: 'vino' } })
  const trasCorregir = await (await ctx.request.get(`${BASE}/api/asistencia?desde=${F}&hasta=${F}`)).json()
  ok(corregir.ok() && trasCorregir.asistencia.length === 1 && trasCorregir.asistencia[0].estado === 'vino',
    'corregirlo no duplica la fila', JSON.stringify(trasCorregir.asistencia))

  const basura = await ctx.request.post(`${BASE}/api/asistencia`, { data: { fecha: F, alumno: ALUMNO, estado: 'quizás' } })
  ok(basura.status() === 400, 'un estado inventado responde 400', String(basura.status()))
  const sinFecha = await ctx.request.post(`${BASE}/api/asistencia`, { data: { alumno: ALUMNO, estado: 'vino' } })
  ok(sinFecha.status() === 400, 'sin fecha responde 400', String(sinFecha.status()))

  const desmarcar = await ctx.request.post(`${BASE}/api/asistencia`, { data: { fecha: F, alumno: ALUMNO, estado: null } })
  const trasBorrar = await (await ctx.request.get(`${BASE}/api/asistencia?desde=${F}&hasta=${F}`)).json()
  ok(desmarcar.ok() && trasBorrar.asistencia.length === 0, 'se puede desmarcar', JSON.stringify(trasBorrar.asistencia))

  console.log('\nLa pantalla')
  const page = await ctx.newPage()
  const errores500 = []
  page.on('response', (r) => { if (r.status() >= 500) errores500.push(`${r.status()} ${r.url()}`) })
  await page.goto(BASE + '/calendario', { waitUntil: 'networkidle' })
  ok(errores500.length === 0, 'el calendario carga sin errores del servidor', errores500.join(' · '))

  const chips = page.locator('button[title*="marcar"], button[title*="Vino"], button[title*="Faltó"]')
  const cuantos = await chips.count()
  ok(cuantos > 0, `los alumnos salen con su puntito (${cuantos} en pantalla)`)

  if (cuantos > 0) {
    const primero = chips.first()
    const antes = await primero.getAttribute('title')
    await primero.click()
    await page.waitForTimeout(600)
    const despues = await primero.getAttribute('title')
    ok(antes !== despues, `tocarlo lo cambia (${antes} → ${despues})`)
    // Se deja como estaba: dos toques más y vuelve a "sin marcar".
    await primero.click(); await page.waitForTimeout(300)
    await primero.click(); await page.waitForTimeout(600)
    ok((await primero.getAttribute('title')) === antes, 'y tocando de nuevo vuelve a como estaba')
  }
} finally {
  await ctx.request.post(`${BASE}/api/asistencia`, { data: { fecha: F, alumno: ALUMNO, estado: null } })
  await browser.close()
}

console.log(`\n${pass} bien, ${fail} mal`)
process.exit(fail === 0 ? 0 : 1)
