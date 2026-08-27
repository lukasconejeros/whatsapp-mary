// Lo de hoy, tocado en la pantalla de verdad con un navegador (Lukas, 27-08-2026):
//   (2) las tarjetas del listado quedaron compactas — sin horario ni plata,
//   (3) el día de clase de la ficha se puede EDITAR, no solo borrar,
//   (4) y en pantalla de teléfono no aparece el botón que lleva al QR.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; node scripts/test-tarjeta-dia-api.mjs

import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''
const MES = '2026-08'

let pass = 0, fail = 0
const ok = (c, m, extra = '') => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m} ${extra}`); fail++ } }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) { console.error(`No se pudo entrar (HTTP ${login.status()})`); await browser.close(); process.exit(2) }

console.log('\n🧪 TEST tarjeta compacta, día editable y el QR fuera del teléfono\n')

// Se busca un alumno que tenga día y hora para poder corregírselos y dejarlos como estaban.
const lista = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
const sujeto = lista.alumnos.find(a => a.inscripciones.length > 0 && a.inscripciones[0].dia)
if (!sujeto) { console.error('No hay ningún alumno con día para probar'); await browser.close(); process.exit(2) }
const insc = sujeto.inscripciones[0]
const original = { dia: insc.dia, hora: insc.hora, horaFin: insc.horaFin, profe: insc.profe }

try {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/alumnos`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-alumno]', { timeout: 15000 })

  // ── (2) La tarjeta compacta ────────────────────────────────────────────────
  console.log('Las tarjetas del listado')
  const tarjeta = page.locator(`[data-alumno="${sujeto.id}"]`)
  const texto = await tarjeta.innerText()
  ok(texto.includes(sujeto.nombre), 'la tarjeta dice el nombre', texto)
  ok(!/\d{2}:\d{2}/.test(texto), 'la tarjeta YA NO trae horas', texto)
  ok(!texto.includes('$'), 'la tarjeta YA NO trae plata', texto)
  ok((await page.locator('[data-pago]').count()) === 0, 'no queda ningún chip de pago en el listado')

  const alto = (await tarjeta.boundingBox())?.height ?? 999
  ok(alto < 110, `la tarjeta es compacta de verdad (${Math.round(alto)}px de alto)`, String(alto))

  // ── (3) El día de clase se edita ───────────────────────────────────────────
  console.log('\nEl día de clase, en la ficha')
  await tarjeta.click()
  await page.waitForSelector(`[data-dia="${insc.id}"]`, { timeout: 8000 })
  ok(true, 'la ficha se abre y lista sus días')

  await page.locator(`[data-dia="${insc.id}"]`).click()
  await page.waitForSelector(`[data-dia-editando="${insc.id}"]`, { timeout: 8000 })
  ok(true, 'al tocar el día se abre para corregirlo')

  const caja = page.locator(`[data-dia-editando="${insc.id}"]`)
  const horas = caja.locator('input')
  await horas.nth(0).fill('09:15')
  await horas.nth(1).fill('10:45')
  await caja.getByRole('button', { name: /Guardar el día/ }).click()
  await page.waitForSelector(`[data-dia="${insc.id}"]`, { timeout: 8000 })

  const guardado = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  const despues = guardado.alumnos.find(a => a.id === sujeto.id).inscripciones.find(i => i.id === insc.id)
  ok(despues.hora === '09:15' && despues.horaFin === '10:45', 'la hora nueva quedó guardada de verdad', JSON.stringify(despues))
  ok(despues.dia === original.dia, 'y no se le cambió el día de rebote', String(despues.dia))

  // Que la API siga frenando lo imposible, ahora desde la pantalla.
  await page.locator(`[data-dia="${insc.id}"]`).click()
  await page.waitForSelector(`[data-dia-editando="${insc.id}"]`)
  const caja2 = page.locator(`[data-dia-editando="${insc.id}"]`)
  await caja2.locator('input').nth(0).fill('18:00')
  await caja2.locator('input').nth(1).fill('17:00')
  await caja2.getByRole('button', { name: /Guardar el día/ }).click()
  await page.waitForTimeout(700)
  const sigueAbierto = await page.locator(`[data-dia-editando="${insc.id}"]`).count()
  ok(sigueAbierto === 1, 'salida antes que la entrada: NO se guarda y el formulario sigue abierto')
  ok((await caja2.innerText()).toLowerCase().includes('después'), 'y le explica por qué', await caja2.innerText())

  // ── (4) El QR fuera del teléfono ───────────────────────────────────────────
  console.log('\nEl botón del QR')
  const conexionPC = await page.locator('a.app-nav-conexion').isVisible()
  ok(conexionPC, 'en el computador el botón de Conexión SIGUE estándo')

  await page.setViewportSize({ width: 390, height: 844 })   // un iPhone
  await page.waitForTimeout(400)
  ok(!(await page.locator('a.app-nav-conexion').isVisible()), 'en el teléfono el botón de Conexión NO se ve')
  ok(await page.locator('a.app-nav-alumnos').isVisible(), 'pero Alumnos SÍ se sigue viendo en el teléfono')
  ok(await page.locator('a.app-nav-inbox').isVisible(), 'y Chats también')
  ok(await page.locator('a.app-nav-calendario').isVisible(), 'y Calendario también')

  await page.screenshot({ path: 'scripts/fixtures/alumnos-compacta-telefono.png', fullPage: false })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: 'scripts/fixtures/alumnos-compacta.png', fullPage: false })
  console.log('  📸 scripts/fixtures/alumnos-compacta.png y -telefono.png')

} finally {
  // Se deja el horario como estaba: esta base es la de pruebas, pero la costumbre
  // de devolver lo que se toca es lo que evita accidentes cuando no lo es.
  await ctx.request.patch(`${BASE}/api/inscripciones/${insc.id}`, { data: original })
  const vuelto = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  const fin = vuelto.alumnos.find(a => a.id === sujeto.id).inscripciones.find(i => i.id === insc.id)
  ok(fin.hora === original.hora && fin.horaFin === original.horaFin, 'el horario quedó como estaba antes de la prueba', JSON.stringify(fin))
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} bien, ${fail} mal\n`)
process.exit(fail === 0 ? 0 : 1)
