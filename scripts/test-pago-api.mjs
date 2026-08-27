// La mensualidad del mes (paso 4 del CRM), por HTTP y tocando la pantalla de verdad.
//
// Lo que tiene que quedar demostrado, no supuesto:
//   · marcar un pago dos veces no cobra dos veces,
//   · el pago de un mes no se ve en otro,
//   · a quien avisó que no viene ese mes NO se le inventa una deuda,
//   · y Mary puede deshacerlo, porque se va a equivocar de alumno alguna vez.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:pago-api

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

const MES = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }).slice(0, 7)
const OTRO_MES = (() => {
  const [a, m] = MES.split('-').map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
})()

let alumno = null, avisado = null, ausenciaId = null
const ficha = async (id, mes = MES) => {
  const d = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${mes}`)).json()
  return d.alumnos.find(a => a.id === id)
}

console.log('\n🧪 TEST de la mensualidad del mes (API + pantalla)\n')

try {
  console.log('Lo que la API NO debe aceptar')
  const alta = await ctx.request.post(`${BASE}/api/alumnos`, { data: { nombre: 'ZZTest Pagador', mensualidad: 60000 } })
  alumno = (await alta.json()).id
  await ctx.request.post(`${BASE}/api/alumnos/${alumno}/inscripciones`, { data: { dia: 'Lunes', hora: '17:30', horaFin: '18:30', profe: 'Mary' } })

  ok((await ctx.request.post(`${BASE}/api/alumnos/${alumno}/pago`, { data: {} })).status() === 400, 'sin mes responde 400')
  ok((await ctx.request.post(`${BASE}/api/alumnos/${alumno}/pago`, { data: { mes: '2026-13' } })).status() === 400, 'un mes inventado responde 400')
  ok((await ctx.request.post(`${BASE}/api/alumnos/${alumno}/pago`, { data: { mes: MES, fecha: 'ayer' } })).status() === 400, 'una fecha que no es fecha responde 400')
  ok((await ctx.request.post(`${BASE}/api/alumnos/999999/pago`, { data: { mes: MES } })).status() === 404, 'un alumno que no existe responde 404')

  const sinPlan = await ctx.request.post(`${BASE}/api/alumnos`, { data: { nombre: 'ZZTest SinPlan' } })
  const sinPlanId = (await sinPlan.json()).id
  ok((await ctx.request.post(`${BASE}/api/alumnos/${sinPlanId}/pago`, { data: { mes: MES } })).status() === 400,
     'sin mensualidad cargada no deja marcar un pago a ciegas')
  const fSinPlan = await ficha(sinPlanId)
  ok(fSinPlan?.pago.estado === 'sin_monto', 'y su ficha lo dice, en vez de sacarlo como deudor', String(fSinPlan?.pago.estado))
  await ctx.request.delete(`${BASE}/api/alumnos/${sinPlanId}`)

  console.log('\nEl estado antes de pagar')
  const antes = await ficha(alumno)
  ok(['pendiente', 'atrasado'].includes(antes?.pago.estado), 'nace debiendo su mensualidad', String(antes?.pago.estado))
  ok(antes?.pago.falta === 60000, 'y debe los 60.000 completos', String(antes?.pago.falta))

  console.log('\nMarcar el pago')
  const r1 = await (await ctx.request.post(`${BASE}/api/alumnos/${alumno}/pago`, { data: { mes: MES } })).json()
  ok(r1.ok && r1.pago.pagado === 60000, 'sin decir monto se entiende «pagó lo suyo»', JSON.stringify(r1.pago))
  const f1 = await ficha(alumno)
  ok(f1?.pago.estado === 'pagado' && f1?.pago.falta === 0, 'la ficha queda pagada y sin deuda', JSON.stringify(f1?.pago))

  await ctx.request.post(`${BASE}/api/alumnos/${alumno}/pago`, { data: { mes: MES } })
  const f2 = await ficha(alumno)
  ok(f2?.pago.pagado === 60000, 'marcarlo dos veces NO cobra doble', JSON.stringify(f2?.pago))

  const otroMes = await ficha(alumno, OTRO_MES)
  ok(otroMes?.pago.estado !== 'pagado', 'el pago de este mes no aparece pagado en el siguiente', String(otroMes?.pago.estado))

  console.log('\nUn abono (pagó una parte)')
  await ctx.request.post(`${BASE}/api/alumnos/${alumno}/pago`, { data: { mes: MES, pagado: 20000 } })
  const f3 = await ficha(alumno)
  ok(f3?.pago.estado === 'parcial' && f3?.pago.falta === 40000, 'queda a medias y dice cuánto falta', JSON.stringify(f3?.pago))

  console.log('\nEl resumen de plata del mes')
  const crm = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  ok(crm.pagos && typeof crm.pagos.cobrado === 'number', 'la API trae el resumen del mes', JSON.stringify(crm.pagos))
  ok(crm.pagos.cobrado >= 20000, 'cuenta lo que ya entró', String(crm.pagos.cobrado))

  console.log('\nA quien avisó que no viene NO se le cobra')
  const alta2 = await ctx.request.post(`${BASE}/api/alumnos`, { data: { nombre: 'ZZTest NoViene', mensualidad: 45000 } })
  avisado = (await alta2.json()).id
  await ctx.request.post(`${BASE}/api/alumnos/${avisado}/inscripciones`, { data: { dia: 'Martes', hora: '17:30', horaFin: '18:30', profe: 'Mary' } })
  const fAntes = await ficha(avisado)
  ok(fAntes?.pago.falta === 45000, 'antes del aviso sí debe', String(fAntes?.pago.falta))
  const av = await (await ctx.request.post(`${BASE}/api/ausencias`, { data: { alumnoId: avisado, tipo: 'mes', mes: MES, motivo: 'viaje' } })).json()
  ausenciaId = av.id
  const fDespues = await ficha(avisado)
  ok(fDespues?.pago.estado === 'no_cobra' && fDespues?.pago.falta === 0, 'después del aviso no debe nada', JSON.stringify(fDespues?.pago))

  console.log('\nLa pantalla de verdad')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/alumnos`, { waitUntil: 'networkidle' })
  const tarjeta = page.locator(`[data-alumno="${alumno}"]`)
  ok(await tarjeta.locator('[data-pago="parcial"]').isVisible(), 'la tarjeta muestra el abono con lo que falta')

  await tarjeta.click()
  await page.waitForTimeout(300)
  ok(await page.getByRole('button', { name: 'Corregir el pago' }).isVisible(), 'la ficha abierta deja corregir el pago')
  await page.getByRole('button', { name: 'Quitar' }).click()
  await page.waitForTimeout(800)
  const f4 = await ficha(alumno)
  ok(f4?.pago.estado !== 'pagado' && f4?.pago.pagado === 0, 'con «Quitar» se deshace de verdad en la base', JSON.stringify(f4?.pago))

  await page.locator(`[data-alumno="${alumno}"]`).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Marcar pagado' }).click()
  await page.waitForTimeout(800)
  const f5 = await ficha(alumno)
  ok(f5?.pago.estado === 'pagado', 'y desde la pantalla se marca pagado de un toque', JSON.stringify(f5?.pago))
  ok(await page.locator(`[data-alumno="${alumno}"] [data-pago="pagado"]`).isVisible(), 'la tarjeta pasa a verde con lo que pagó')

  await page.screenshot({ path: 'scripts/fixtures/alumnos-mensualidad.png', fullPage: false })
  console.log('  📸 scripts/fixtures/alumnos-mensualidad.png')
} finally {
  if (ausenciaId) await ctx.request.delete(`${BASE}/api/ausencias/${ausenciaId}`)
  if (alumno) await ctx.request.delete(`${BASE}/api/alumnos/${alumno}`)
  if (avisado) await ctx.request.delete(`${BASE}/api/alumnos/${avisado}`)
  const limpio = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  ok(!limpio.alumnos?.some(a => a.nombre.startsWith('ZZTest')), 'el test no deja nada suyo en la base')
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} bien, ${fail} mal\n`)
process.exit(fail === 0 ? 0 : 1)
