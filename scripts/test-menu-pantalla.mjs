// ¿Ve Mary el botón "Entrenar IA" en el menú, y llega a la pantalla al tocarlo?
//
// Lukas, 20-08-2026: "todavía no está la pestaña a la izquierda de entrenar ia".
// La pantalla existía y estaba desplegada, pero NINGÚN botón de la app llevaba a
// ella. Este test lo comprueba en un iPhone 13 emulado (la barra de abajo) y en
// pantalla de computador (la columna de la izquierda).
//
// ⚠️ REESCRITO el 08-09-2026 (segunda vez ese día). El 08-09 Lukas pidió limpiar la
// app del teléfono y "Entrenar IA" se escondió allí a propósito: desde entonces este
// test exigía verlo en el iPhone, fallaba 4 casos y se caía con un TypeError al pedir
// el tamaño de un botón invisible (boundingBox() de un display:none devuelve null).
// Custodiaba una regla derogada. Ahora comprueba la regla de VERDAD, que son dos:
// en el teléfono Entrenar IA NO se ve, y en el computador sí, se puede apretar y lleva
// a su pantalla. Es la misma lección que dejó test:calendario-iphone ese mismo día.
//
// Cómo correrlo:
//   1) levanta la app:  $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) en otra consola: $env:BASE="http://localhost:3011"; npm run test:menu-pantalla

import { chromium, devices } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || 'test1234'

let pass = 0, fail = 0
const check = (n, c, e = '') => { if (c) { console.log(`  ✅ ${n}`); pass++ } else { console.log(`  ❌ ${n} ${e}`); fail++ } }

const browser = await chromium.launch()

for (const [nombre, opciones] of [['iPhone 13', devices['iPhone 13']], ['computador', { viewport: { width: 1280, height: 800 } }]]) {
  const ctx = await browser.newContext(opciones)
  const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
  if (!login.ok()) { console.error(`No se pudo entrar (HTTP ${login.status()})`); process.exit(2) }
  const page = await ctx.newPage()

  console.log(`\n📱 ${nombre}`)
  await page.goto(BASE + '/inbox', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('nav.app-sidebar a', { timeout: 20000 })

  // Lo que se VE de verdad: en el teléfono la barra de abajo solo deja Chats, Finanzas,
  // Calendario y Alumnos; el resto está escondido por CSS.
  const visibles = await page.$$eval('nav.app-sidebar a', ns => ns
    .filter(n => getComputedStyle(n).display !== 'none')
    .map(n => n.innerText.trim().replace(/\s+/g, ' ')))

  if (nombre === 'iPhone 13') {
    check('en el teléfono se ven los 4 de Mary', ['Chats', 'Finanzas', 'Calendario', 'Alumnos'].every(l => visibles.includes(l)), visibles.join(','))
    check('y Entrenar IA NO se ve (es del computador)', !visibles.some(l => /Entrenar/.test(l)), visibles.join(','))
    check('ni Bot, ni Conexión, ni Formularios', !visibles.some(l => /^(Bot|Conexión|Formularios)$/.test(l)), visibles.join(','))
    check('la pantalla /configuracion sigue viva escribiendo la dirección', true)
    await page.goto(BASE + '/configuracion', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('h1:has-text("Entrenar IA")', { timeout: 20000 })
    check('y se abre bien en el teléfono', /configuracion/.test(page.url()), page.url())
    await ctx.close()
    continue
  }

  check('el menú muestra "Entrenar IA"', visibles.includes('Entrenar IA'), visibles.join(','))
  check('no se ven las dos etiquetas juntas', !visibles.some(l => /Entrenar IA ?Entrenar/.test(l)), visibles.join(','))
  check('siguen los 5 de siempre', ['Chats', 'Finanzas', 'Calendario', 'Bot', 'Conexión'].every(l => visibles.includes(l)), visibles.join(','))
  check('Entrenar IA va después de Bot', visibles.indexOf('Entrenar IA') === visibles.indexOf('Bot') + 1, visibles.join(','))
  check('y Formularios entró antes de Bot (08-09-2026)', visibles.indexOf('Formularios') === visibles.indexOf('Bot') - 1, visibles.join(','))

  const boton = page.locator('nav.app-sidebar a[href="/configuracion"]').first()
  const caja = await boton.boundingBox()
  // El mínimo de 44 px es para el dedo: se exige en el teléfono. En el computador
  // se comprueba que mida IGUAL que los botones de siempre (38 px de alto, el
  // estilo de la barra lateral), no que llegue a 44.
  const cajaChats = await page.locator('nav.app-sidebar a[href="/inbox"]').first().boundingBox()
  check(`mide lo mismo que los botones de siempre (${Math.round(caja.width)}x${Math.round(caja.height)})`,
    Math.abs(caja.height - cajaChats.height) < 1 && Math.abs(caja.width - cajaChats.width) < 1, JSON.stringify({ caja, cajaChats }))
  check('no se sale de la pantalla', caja.x >= 0 && caja.x + caja.width <= (opciones.viewport?.width ?? 390) + 1, JSON.stringify(caja))

  await boton.click()
  await page.waitForURL('**/configuracion', { timeout: 20000 })
  check('el botón lleva a Entrenar IA', page.url().endsWith('/configuracion'), page.url())
  await page.waitForSelector('h1:has-text("Entrenar IA")', { timeout: 20000 })
  const texto = await page.textContent('body')
  check('la pantalla trae el bloque de Promociones', /Promociones/i.test(texto))
  check('la pantalla conserva el menú para volver', await page.locator('nav.app-sidebar a[href="/inbox"]').count() > 0)
  const cajaFinal = await page.locator('nav.app-sidebar a[href="/configuracion"]').first().boundingBox()
  const cajaBot = await page.locator('nav.app-sidebar a[href="/ensayo"]').first().boundingBox()
  check(`la etiqueta cabe en una línea, como los demás (${Math.round(cajaFinal.height)} vs ${Math.round(cajaBot.height)})`,
    Math.abs(cajaFinal.height - cajaBot.height) < 2, JSON.stringify({ cajaFinal, cajaBot }))

  await ctx.close()
}

await browser.close()
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} bien, ${fail} mal\n`)
process.exit(fail === 0 ? 0 : 1)
