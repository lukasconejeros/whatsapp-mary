// La pestaña Alumnos por HTTP y en la pantalla: que Mary pueda ver a sus alumnos del
// mes, arreglar una ficha, resolver las dudas que dejó la planilla y dar de alta a
// alguien nuevo (Lukas, 26-08-2026).
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:alumnos-api

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

const NOMBRE = 'ZZTest Nueva Alumna'
let creado = null

console.log('\n🧪 TEST alumnos (API + pantalla)\n')

try {
  console.log('La API')
  const r = await ctx.request.get(`${BASE}/api/alumnos?mes=2026-08`)
  const d = await r.json()
  ok(r.ok() && d.ok && Array.isArray(d.alumnos), 'devuelve las fichas del mes', String(r.status()))
  // 37, no 41: el 26-08 se unieron las que estaban dos veces en la planilla con el
  // nombre a medias (Julieta = Julieta Bratz, etc.), y quedaron 37 fichas con 43
  // inscripciones. El número de arriba se quedó viejo con esa unión.
  ok(d.alumnos.length >= 35, 'están cargados los alumnos del horario', String(d.alumnos.length))
  const conDias = d.alumnos.find(a => a.inscripciones.length > 0)
  ok(!!conDias && typeof conDias.inscripciones[0].hora === 'string', 'cada ficha trae sus días y horas')
  ok(d.alumnos.every(a => Array.isArray(a.faltas)), 'y las faltas del mes')
  ok(d.alumnos.some(a => a.revisar), 'las dudas de la planilla vienen marcadas')

  const malMes = await ctx.request.get(`${BASE}/api/alumnos?mes=agosto`)
  ok(malMes.status() === 400, 'un mes con formato raro responde 400', String(malMes.status()))

  const sinMes = await ctx.request.get(`${BASE}/api/alumnos`)
  ok(sinMes.ok(), 'sin mes usa el mes de hoy', String(sinMes.status()))

  const sinNombre = await ctx.request.post(`${BASE}/api/alumnos`, { data: { mensualidad: 1000 } })
  ok(sinNombre.status() === 400, 'crear sin nombre responde 400', String(sinNombre.status()))

  const alta = await ctx.request.post(`${BASE}/api/alumnos`, {
    data: { nombre: NOMBRE, apoderado: 'Papá de prueba', telefono: '+56900000000', mensualidad: 55000 },
  })
  const altaJson = await alta.json()
  creado = altaJson.id
  ok(alta.ok() && typeof creado === 'number', 'da de alta a una alumna nueva', JSON.stringify(altaJson))

  const conNueva = await (await ctx.request.get(`${BASE}/api/alumnos?mes=2026-08`)).json()
  const nueva = conNueva.alumnos.find(a => a.id === creado)
  ok(!!nueva && nueva.mensualidad === 55000, 'y aparece en la lista con su mensualidad', JSON.stringify(nueva))

  const ins = await ctx.request.post(`${BASE}/api/alumnos/${creado}/inscripciones`, {
    data: { dia: 'Martes', hora: '17:30', horaFin: '18:30', profe: 'Paula' },
  })
  ok(ins.ok(), 'se le pone un día de clase', String(ins.status()))
  const conDia = await (await ctx.request.get(`${BASE}/api/alumnos?mes=2026-08`)).json()
  const conIns = conDia.alumnos.find(a => a.id === creado)
  ok(conIns?.inscripciones[0]?.dia === 'Martes' && conIns?.inscripciones[0]?.horaFin === '18:30', 'con SU hora de salida', JSON.stringify(conIns?.inscripciones))

  const editar = await ctx.request.patch(`${BASE}/api/alumnos/${creado}`, {
    data: { nombre: NOMBRE, mensualidad: 70000, telefono: '+56911112222', revisar: null },
  })
  ok(editar.ok(), 'se corrige la ficha', String(editar.status()))
  const trasEditar = await (await ctx.request.get(`${BASE}/api/alumnos?mes=2026-08`)).json()
  const editada = trasEditar.alumnos.find(a => a.id === creado)
  ok(editada?.mensualidad === 70000 && editada?.telefono === '+56911112222', 'y queda guardado', JSON.stringify(editada))
  ok(editada?.revisar === null, 'resolver la duda le quita la marca')

  console.log('\nLa pantalla')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/alumnos`, { waitUntil: 'networkidle' })
  ok(await page.getByText(NOMBRE).first().isVisible(), 'la alumna nueva se ve en la pantalla')
  const tarjetas = await page.locator('[data-alumno]').count()
  ok(tarjetas >= 40, 'se ven las tarjetas de todos los alumnos', String(tarjetas))
  ok(await page.locator('[data-mes]').first().isVisible(), 'hay un selector de mes')
  ok(await page.getByRole('link', { name: 'Alumnos' }).first().isVisible(), 'y el botón Alumnos está en el menú')

  // El aviso de lo que hay que confirmar con Mary, que es el trabajo pendiente.
  ok(await page.locator('[data-revisar]').first().isVisible(), 'las fichas con dudas avisan en pantalla')

  await page.screenshot({ path: 'scripts/fixtures/alumnos.png', fullPage: false })
  console.log('  📸 scripts/fixtures/alumnos.png')
} finally {
  if (creado) await ctx.request.delete(`${BASE}/api/alumnos/${creado}`)
  const limpio = await (await ctx.request.get(`${BASE}/api/alumnos?mes=2026-08`)).json()
  ok(!limpio.alumnos?.some(a => a.nombre === NOMBRE), 'el test no deja alumnos suyos')
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} bien, ${fail} mal\n`)
process.exit(fail === 0 ? 0 : 1)
