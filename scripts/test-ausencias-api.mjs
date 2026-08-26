// El botón "no viene", por HTTP y tocándolo en la pantalla de verdad
// (Lukas, 26-08-2026: "que pregunte la app si no viene en todo el mes o solo ese día,
// y si dice que falta ese día que se ponga en gris en el calendario ese día").
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:ausencias-api

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

/** El próximo lunes (el horario de Mary siempre tiene gente los lunes). */
function proximoLunes() {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const LUNES = proximoLunes()
const MES = LUNES.slice(0, 7)

const creadas = []
let alumnoTest = null

console.log('\n🧪 TEST del botón «no viene» (API + pantalla)\n')

try {
  console.log('El horario que dibuja el calendario')
  const ins = await (await ctx.request.get(`${BASE}/api/inscripciones`)).json()
  ok(ins.ok && ins.inscripciones.length >= 40, 'la API trae las inscripciones con nombre', String(ins.inscripciones?.length))
  ok(ins.inscripciones.every(i => typeof i.nombre === 'string' && typeof i.hora === 'string'), 'cada una con su alumno y su hora')
  const lunes = ins.inscripciones.filter(i => i.dia === 'Lunes')
  ok(lunes.length > 0, 'los lunes tienen alumnos', String(lunes.length))

  console.log('\nLa API de ausencias')
  const vacio = await ctx.request.get(`${BASE}/api/ausencias`)
  ok(vacio.status() === 400, 'sin desde/hasta responde 400', String(vacio.status()))

  const malTipo = await ctx.request.post(`${BASE}/api/ausencias`, { data: { alumnoId: lunes[0].alumnoId, tipo: 'semana', fecha: LUNES } })
  ok(malTipo.status() === 400, 'un tipo que no es día ni mes responde 400', String(malTipo.status()))

  const sinFecha = await ctx.request.post(`${BASE}/api/ausencias`, { data: { alumnoId: lunes[0].alumnoId, tipo: 'dia' } })
  ok(sinFecha.status() === 400, 'una ausencia de día sin fecha responde 400', String(sinFecha.status()))

  const fantasma = await ctx.request.post(`${BASE}/api/ausencias`, { data: { alumnoId: 999999, tipo: 'dia', fecha: LUNES } })
  ok(fantasma.status() === 400, 'un alumno que no existe responde 400', String(fantasma.status()))

  // Un alumno de prueba propio: no se le tocan los avisos a los alumnos de verdad.
  const alta = await ctx.request.post(`${BASE}/api/alumnos`, { data: { nombre: 'ZZTest Ausente', mensualidad: 50000 } })
  alumnoTest = (await alta.json()).id
  await ctx.request.post(`${BASE}/api/alumnos/${alumnoTest}/inscripciones`, {
    data: { dia: 'Lunes', hora: '17:30', horaFin: '18:30', profe: 'Mary' },
  })

  const av = await ctx.request.post(`${BASE}/api/ausencias`, { data: { alumnoId: alumnoTest, tipo: 'dia', fecha: LUNES, motivo: 'viaje' } })
  const avJson = await av.json()
  creadas.push(avJson.id)
  ok(av.ok() && typeof avJson.id === 'number', 'guarda que no viene ese lunes', JSON.stringify(avJson))

  const otraVez = await (await ctx.request.post(`${BASE}/api/ausencias`, { data: { alumnoId: alumnoTest, tipo: 'dia', fecha: LUNES } })).json()
  ok(otraVez.id === avJson.id, 'tocarlo dos veces no duplica el aviso', `${avJson.id} vs ${otraVez.id}`)

  const rango = await (await ctx.request.get(`${BASE}/api/ausencias?desde=${LUNES}&hasta=${LUNES}`)).json()
  ok(rango.ok && rango.ausencias.some(a => a.id === avJson.id), 'el calendario la ve en su rango')

  console.log('\nEl CRM del mes')
  const crm = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  const ficha = crm.alumnos.find(a => a.id === alumnoTest)
  ok(ficha?.avisadas?.includes(LUNES), 'la ficha muestra el día avisado', JSON.stringify(ficha?.avisadas))
  ok(ficha?.recuperativas === 1, 'y le cuenta una clase recuperativa', String(ficha?.recuperativas))
  ok(ficha?.noVieneEsteMes === false, 'faltar un día NO lo saca del mes')

  console.log('\nLa pantalla del calendario')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/calendario`, { waitUntil: 'networkidle' })
  await page.locator(`[data-fecha="${LUNES}"]`).click()
  await page.waitForTimeout(300)
  ok(await page.locator('[data-sala]').first().isVisible(), 'el lunes muestra las salas de las profesoras')
  const chip = page.locator('[data-chip-alumno="ZZTest Ausente"]').first()
  ok(await chip.isVisible(), 'la alumna de prueba aparece en su sala')
  ok(await chip.getAttribute('data-estado') === 'aviso-dia', 'y sale marcada como que no viene (gris)', String(await chip.getAttribute('data-estado')))

  // Deshacer desde la pantalla: tocar el chip → "Sí viene".
  await chip.click()
  ok(await page.locator('[data-menu-alumno]').isVisible(), 'al tocarla se abre su menú')
  await page.getByRole('button', { name: 'Sí viene', exact: false }).first().click()
  await page.waitForTimeout(600)
  ok(await page.locator('[data-chip-alumno="ZZTest Ausente"]').first().getAttribute('data-estado') === 'normal', 'con «Sí viene» vuelve a la normalidad')

  // Y volver a avisar desde la pantalla, con la pregunta de día o mes.
  await page.locator('[data-chip-alumno="ZZTest Ausente"]').first().click()
  await page.getByRole('button', { name: 'Avisó que no viene' }).click()
  ok(await page.getByText('¿No viene solo este día').isVisible(), 'pregunta si es solo ese día o todo el mes')
  await page.getByRole('button', { name: /^Solo el/ }).click()
  await page.waitForTimeout(700)
  const estadoFinal = await page.locator('[data-chip-alumno="ZZTest Ausente"]').first().getAttribute('data-estado')
  ok(estadoFinal === 'aviso-dia', 'tocando «solo este día» queda en gris', String(estadoFinal))
  const trasPantalla = await (await ctx.request.get(`${BASE}/api/ausencias?desde=${LUNES}&hasta=${LUNES}`)).json()
  const nueva = trasPantalla.ausencias.find(a => a.alumnoId === alumnoTest)
  ok(!!nueva && nueva.tipo === 'dia', 'y quedó guardado de verdad en la base', JSON.stringify(nueva))
  if (nueva) creadas.push(nueva.id)

  await page.screenshot({ path: 'scripts/fixtures/calendario-no-viene.png', fullPage: false })
  console.log('  📸 scripts/fixtures/calendario-no-viene.png')

  console.log('\nEl mes entero: sale del CRM y vuelve solo')
  const mesFuera = await (await ctx.request.post(`${BASE}/api/ausencias`, { data: { alumnoId: alumnoTest, tipo: 'mes', mes: MES, motivo: 'se va de viaje' } })).json()
  creadas.push(mesFuera.id)
  const crm2 = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  const ficha2 = crm2.alumnos.find(a => a.id === alumnoTest)
  ok(ficha2?.noVieneEsteMes === true, 'la ficha queda marcada fuera de este mes')
  ok(ficha2?.motivoMes === 'se va de viaje', 'con su motivo', String(ficha2?.motivoMes))

  const pageAl = await ctx.newPage()
  await pageAl.goto(`${BASE}/alumnos?`, { waitUntil: 'networkidle' })
  // La pestaña abre en el mes de hoy; si el lunes de prueba cae el mes que viene,
  // hay que pasar de mes para verla.
  const hoyMes = new Date().toISOString().slice(0, 7)
  if (MES !== hoyMes) { await pageAl.getByTitle('Mes siguiente').click(); await pageAl.waitForTimeout(700) }
  ok(await pageAl.locator('[data-fuera-del-mes]').isVisible(), 'la pestaña Alumnos la muestra aparte, en «no vienen»')
  ok(await pageAl.getByText('ZZTest Ausente').first().isVisible(), 'con su nombre a la vista para poder devolverla')
  await pageAl.screenshot({ path: 'scripts/fixtures/alumnos-no-vienen.png', fullPage: false })
  console.log('  📸 scripts/fixtures/alumnos-no-vienen.png')
} finally {
  for (const id of creadas) if (id) await ctx.request.delete(`${BASE}/api/ausencias/${id}`)
  if (alumnoTest) await ctx.request.delete(`${BASE}/api/alumnos/${alumnoTest}`)
  const limpio = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  ok(!limpio.alumnos?.some(a => a.nombre === 'ZZTest Ausente'), 'el test no deja nada suyo en la base')
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} bien, ${fail} mal\n`)
process.exit(fail === 0 ? 0 : 1)
