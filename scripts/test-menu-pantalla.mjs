// ¿Ve Mary el botón "Entrenar IA" en el menú, y llega a la pantalla al tocarlo?
//
// Lukas, 20-08-2026: "todavía no está la pestaña a la izquierda de entrenar ia".
// La pantalla existía y estaba desplegada, pero NINGÚN botón de la app llevaba a
// ella. Este test lo comprueba en un iPhone 13 emulado (la barra de abajo) y en
// pantalla de computador (la columna de la izquierda).
//
// Cómo correrlo:
//   1) levanta la app:  $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) en otra consola: $env:BASE="http://localhost:3011"; npm run test:menu-pantalla

import { chromium, devices } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || 'test1234'
const MINIMO = 44

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

  // innerText da lo que se VE: en el teléfono la etiqueta corta, en el computador la larga.
  const labels = await page.$$eval('nav.app-sidebar a', ns => ns.map(n => n.innerText.trim().replace(/\s+/g, ' ')))
  const esperada = nombre === 'iPhone 13' ? 'Entrenar' : 'Entrenar IA'
  check(`el menú muestra "${esperada}"`, labels.includes(esperada), labels.join(','))
  check('no se ven las dos etiquetas juntas', !labels.some(l => /Entrenar IA ?Entrenar/.test(l)), labels.join(','))
  check('siguen los 5 de siempre', ['Chats', 'Finanzas', 'Calendario', 'Bot', 'Conexión'].every(l => labels.includes(l)), labels.join(','))
  check('Entrenar IA va después de Bot', labels.indexOf(esperada) === labels.indexOf('Bot') + 1, labels.join(','))

  const boton = page.locator('nav.app-sidebar a[href="/configuracion"]').first()
  const caja = await boton.boundingBox()
  // El mínimo de 44 px es para el dedo: se exige en el teléfono. En el computador
  // se comprueba que mida IGUAL que los botones de siempre (38 px de alto, el
  // estilo de la barra lateral), no que llegue a 44.
  const cajaChats = await page.locator('nav.app-sidebar a[href="/inbox"]').first().boundingBox()
  if (nombre === 'iPhone 13') {
    check(`se puede apretar con el dedo (${Math.round(caja.width)}x${Math.round(caja.height)})`, caja.height >= MINIMO, JSON.stringify(caja))
  } else {
    check(`mide lo mismo que los botones de siempre (${Math.round(caja.width)}x${Math.round(caja.height)})`,
      Math.abs(caja.height - cajaChats.height) < 1 && Math.abs(caja.width - cajaChats.width) < 1, JSON.stringify({ caja, cajaChats }))
  }
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
