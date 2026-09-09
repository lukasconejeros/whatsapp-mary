// La limpieza de la app que pidió Lukas el 08-09-2026, medida en la pantalla de verdad.
//
// Encargo textual: "que en la app no aparezca ni bot ni entrenar, que en el calendario le
// saques el dictar, que en vez de formulario diga añadir y aparezca arriba (…) y que en
// clase, en buscar alumnos, aparezcan solo los que están en el CRM de alumnos".
//
// Lo que se comprueba acá, y que ningún otro test custodia:
//   (1) en el TELÉFONO no están «Bot» ni «Entrenar» en la barra de abajo…
//   (2) …y en el COMPUTADOR siguen estando (Lukas los usa para entrenar el bot)
//   (3) el botón «Dictar» ya no está en el calendario
//   (4) «Añadir» existe, está ARRIBA (por encima del detalle del día) y abre el formulario
//   (5) el buscador de alumnos lista SOLO el CRM, no los 60 contactos de WhatsApp
//   (6) al guardar, el alumno elegido queda en el día con su NOMBRE
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:telefono-limpia

import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''

let pass = 0, fail = 0
const ok = (c, m, extra = '') => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m} ${extra}`); fail++ } }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  await browser.close(); process.exit(2)
}

const page = await ctx.newPage()
const errores500 = []
page.on('response', r => { if (r.status() >= 500) errores500.push(`${r.status()} ${r.url()}`) })

console.log('\n🧪 La app limpia en el teléfono (390x844)\n')
await page.goto(BASE + '/calendario', { waitUntil: 'networkidle' })

// ── (1) La barra de abajo, sin Bot ni Entrenar ───────────────────────────────
console.log('El menú de abajo')
const visibles = await page.locator('.app-navitems a:visible').evaluateAll(els => els.map(e => e.innerText.trim()))
ok(!visibles.some(t => /^Bot$/i.test(t)), `«Bot» no aparece en el teléfono (${visibles.join(' · ')})`, visibles.join('|'))
ok(!visibles.some(t => /Entrenar/i.test(t)), '«Entrenar» no aparece en el teléfono')
ok(!visibles.some(t => /Conexi/i.test(t)), 'y el QR sigue fuera, como ya estaba')
for (const q of ['Chats', 'Finanzas', 'Calendario', 'Alumnos']) {
  ok(visibles.some(t => t.includes(q)), `«${q}» sí sigue en la barra`)
}

// ── (3) y (4) Dictar fuera, Añadir arriba ────────────────────────────────────
console.log('\nEl calendario')
ok(await page.getByRole('button', { name: 'Dictar' }).count() === 0, 'el botón «Dictar» ya no está')
ok(await page.getByRole('button', { name: 'Formulario' }).count() === 0, 'ya no dice «Formulario»')
const añadir = page.getByRole('button', { name: 'Añadir' }).first()
ok(await añadir.count() > 0, 'el botón dice «Añadir»')
const cajaAñadir = await añadir.boundingBox()
const cajaDetalle = await page.locator('.cal-detail').boundingBox()
ok(cajaAñadir && cajaDetalle && cajaAñadir.y < cajaDetalle.y,
  `«Añadir» está ARRIBA, sin tener que bajar hasta el detalle del día (botón ${Math.round(cajaAñadir?.y ?? -1)}px, detalle ${Math.round(cajaDetalle?.y ?? -1)}px)`)
ok(cajaAñadir && cajaAñadir.height >= 34, `y se puede tocar con el dedo (${Math.round(cajaAñadir?.height ?? 0)}px de alto)`)

// ── (5) El buscador de alumnos: solo el CRM ──────────────────────────────────
console.log('\nEl buscador de alumnos')
const crm = await (await ctx.request.get(BASE + '/api/alumnos')).json()
const contactos = await (await ctx.request.get(BASE + '/api/clientes')).json()
const nombresCrm = (crm.alumnos ?? []).map(a => a.nombre).sort()
await añadir.click()
await page.getByRole('button', { name: 'clase', exact: true }).click()
const enPantalla = await page.locator('[data-alumno]').evaluateAll(els => els.map(e => e.getAttribute('data-alumno')))
ok(enPantalla.length === nombresCrm.length,
  `la lista trae los ${nombresCrm.length} alumnos del CRM (en pantalla ${enPantalla.length})`, JSON.stringify(enPantalla.slice(0, 5)))
ok([...enPantalla].sort().join('|') === nombresCrm.join('|'), 'y son exactamente los mismos, uno por uno')
const soloContactos = (contactos.clientes ?? []).map(c => c.nombre).filter(n => n && !nombresCrm.includes(n))
ok(soloContactos.length > 0 && !enPantalla.some(n => soloContactos.includes(n)),
  `ningún contacto de WhatsApp que NO es alumno se cuela (${soloContactos.length} quedaron fuera)`)

// ── (6) Guardar una clase con un alumno del CRM ──────────────────────────────
console.log('\nGuardar con un alumno del CRM')
let creada = null
if (enPantalla.length > 0) {
  const elegido = enPantalla[0]
  await page.locator(`[data-alumno="${elegido.replace(/"/g, '\\"')}"]`).click()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForTimeout(1200)
  const clases = await (await ctx.request.get(BASE + '/api/clases')).json()
  const mia = (clases.clases ?? []).filter(c => (c.alumnos ?? []).includes(elegido)).pop()
  ok(!!mia, `la clase se guarda con el NOMBRE del alumno, no con un número ("${elegido}")`)
  if (mia) {
    creada = mia.id
    ok((await page.getByText(elegido).count()) > 0, 'y el alumno se ve en el día')
  }
}

ok(errores500.length === 0, `ninguna llamada devolvió 500 (${errores500.length ? errores500[0] : 'ninguna'})`)

// Limpieza: este test crea una clase de verdad en la base.
if (creada) await ctx.request.delete(`${BASE}/api/clases/${creada}`)

// ── (2) En el COMPUTADOR no se pierde nada ───────────────────────────────────
// Se esconden en el teléfono, no se borran: Lukas entrena el bot desde el computador.
console.log('\nEl computador, que no se toca')
const ctxPc = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctxPc.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
const pagePc = await ctxPc.newPage()
await pagePc.goto(BASE + '/calendario', { waitUntil: 'networkidle' })
const visiblesPc = await pagePc.locator('.app-navitems a:visible').evaluateAll(els => els.map(e => e.innerText.trim()))
ok(visiblesPc.some(t => /^Bot$/i.test(t)), `«Bot» sigue en el computador (${visiblesPc.join(' · ')})`)
ok(visiblesPc.some(t => /Entrenar/i.test(t)), '«Entrenar IA» sigue en el computador')
ok((await pagePc.getByRole('button', { name: 'Añadir' }).count()) > 0, 'y el botón «Añadir» también está en el computador')

await browser.close()
console.log(`\n${fail === 0 ? '🎉' : '💥'}  ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
