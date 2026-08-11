// El formulario del calendario con sus 4 tipos: clase, alumno, pago y recordatorio.
//
// Lukas, 10-08-2026: "en el calendario, aparte de lo que ya hay, que haya un formulario, y
// que el formulario sea pagos, alumnos y recordatorio (…) totalmente adaptado" a Arteluk.
//
// Esto NO se puede probar con los tests de la base: el 10-08 los 32 candados de las secciones
// estaban verdes y la pantalla daba 500 por un import mal puesto (error #21 del repo). Este
// test usa la pantalla de verdad: toca las pestañas, llena los campos, guarda y comprueba que
// lo guardado APARECE en el día.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:calendario-extras

import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m}`); fail++ } }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  await browser.close(); process.exit(2)
}

const hoy = new Date()
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const HOY = ymd(hoy)
const DIA_HOY = hoy.getDate()

// Lo que deja este test, para borrarlo al final aunque reviente algo por el medio.
const creados = { pagos: [], recordatorios: [], fijas: [] }

const page = await ctx.newPage()
const errores500 = []
page.on('response', (r) => { if (r.status() >= 500) errores500.push(`${r.status()} ${r.url()}`) })

console.log('\n🧪 TEST formulario del calendario (clase / alumno / pago / recordatorio)\n')

await page.goto(BASE + '/calendario', { waitUntil: 'networkidle' })
ok(!errores500.length, 'la pantalla del calendario carga sin errores 500')

// ── El selector de tipos ─────────────────────────────────────────────────────
await page.getByRole('button', { name: 'Agregar' }).first().click()
await page.getByRole('button', { name: 'Prefiero a mano' }).click()
for (const t of ['clase', 'alumno', 'pago', 'Recordar']) {
  ok(await page.getByRole('button', { name: t, exact: true }).isVisible(), `está la pestaña «${t}»`)
}

// ── PAGO que vuelve todos los meses ──────────────────────────────────────────
console.log('\nPago que vuelve cada mes')
await page.getByRole('button', { name: 'pago', exact: true }).click()
await page.selectOption('select', 'otros')
ok(
  (await page.getByText('Descripción (obligatoria)').count()) > 0,
  'al elegir «Otros» la descripción pasa a ser obligatoria (lo que pidió Lukas)'
)
await page.getByRole('button', { name: 'Guardar' }).click()
ok(
  (await page.getByText('Escribe de qué es el pago.').count()) > 0,
  'un pago «Otros» sin descripción no se guarda y avisa en cristiano'
)
await page.getByPlaceholder('Ej: materiales de acuarela').fill('PRUEBA materiales de acuarela')
await page.getByPlaceholder('250000').fill('47500')
await page.getByPlaceholder('5', { exact: true }).fill(String(DIA_HOY))
await page.getByRole('button', { name: 'Guardar' }).click()
await page.waitForTimeout(900)
ok((await page.getByText('PRUEBA materiales de acuarela').count()) > 0, 'el pago aparece en el día, con su descripción')
ok((await page.getByText('$47.500').count()) > 0, 'el monto se ve con puntos, como se lee en Chile')
ok((await page.getByText('todos los meses').count()) > 0, 'se ve que vuelve todos los meses')

// ── RECORDATORIO ────────────────────────────────────────────────────────────
console.log('\nRecordatorio')
await page.getByRole('button', { name: 'Agregar' }).first().click()
await page.getByRole('button', { name: 'Prefiero a mano' }).click()
await page.getByRole('button', { name: 'Recordar', exact: true }).click()
await page.getByPlaceholder('Ej: comprar acuarelas').fill('PRUEBA comprar acuarelas')
await page.getByRole('button', { name: 'Guardar' }).click()
await page.waitForTimeout(900)
ok((await page.getByText('PRUEBA comprar acuarelas').count()) > 0, 'el recordatorio aparece en el día')
// El envío por WhatsApp ya existe (10-08-2026), pero recién creado NO ha salido:
// la tarjeta dice que le LLEGA (futuro), nunca que le llegó.
ok(
  (await page.getByText('Te llega por WhatsApp').count()) > 0,
  'dice que el recordatorio le llega por WhatsApp'
)
ok(
  (await page.getByText('Te llegó por WhatsApp').count()) === 0,
  'NO lo da por enviado antes de que WhatsApp lo mande'
)

// ── ALUMNO que se repite todas las semanas ──────────────────────────────────
console.log('\nAlumno que se repite')
await page.getByRole('button', { name: 'Agregar' }).first().click()
await page.getByRole('button', { name: 'Prefiero a mano' }).click()
await page.getByRole('button', { name: 'alumno', exact: true }).click()
await page.getByPlaceholder('Ej: Amelia').fill('PRUEBA Amelia')
await page.selectOption('select', 'nuevo')
const opcionesProfe = await page.locator('select').nth(2).locator('option').allTextContents()
ok(opcionesProfe.includes('Mary') && opcionesProfe.includes('Paula'), `la profe se elige entre Mary y Paula (${opcionesProfe.join(', ')})`)
// El día del horario nuevo = el día de hoy, para poder verlo en la pantalla al tiro.
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const diaHoy = DIAS[hoy.getDay()]
if (diaHoy === 'Domingo') {
  console.log('  ⏭️  hoy es domingo y el selector solo trae lunes a sábado: se salta la comprobación en pantalla')
} else {
  await page.locator('select').nth(1).selectOption(diaHoy)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(900)
  ok((await page.getByText('PRUEBA Amelia').count()) > 0, 'el alumno aparece en su horario del día')
  ok((await page.getByText('todas las semanas').count()) > 0, 'el horario queda marcado como de todas las semanas')
}

ok(!errores500.length, `ninguna llamada devolvió 500 (${errores500.join(' · ') || 'ninguna'})`)

// ── Limpieza: esto corre contra una base real, no puede dejar basura ─────────
const pagos = await (await ctx.request.get(BASE + '/api/pagos-fijos')).json()
for (const p of pagos.pagosFijos ?? []) if (p.descripcion?.startsWith('PRUEBA')) creados.pagos.push(p.id)
const recs = await (await ctx.request.get(`${BASE}/api/recordatorios?desde=${HOY}&hasta=${HOY}`)).json()
for (const r of recs.recordatorios ?? []) if (r.texto.startsWith('PRUEBA')) creados.recordatorios.push(r.id)
const fijas = await (await ctx.request.get(BASE + '/api/clases-fijas')).json()
for (const f of fijas.clasesFijas ?? []) if ((f.alumnos ?? []).some(a => String(a).startsWith('PRUEBA'))) creados.fijas.push(f.id)

for (const id of creados.pagos) await ctx.request.delete(`${BASE}/api/pagos-fijos/${id}`)
for (const id of creados.recordatorios) await ctx.request.delete(`${BASE}/api/recordatorios/${id}`)
for (const id of creados.fijas) await ctx.request.delete(`${BASE}/api/clases-fijas/${id}`)
console.log(`\n🧹 borrado lo de prueba: ${creados.pagos.length} pagos, ${creados.recordatorios.length} recordatorios, ${creados.fijas.length} horarios`)

await browser.close()
console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
