// La caja de PROMOCIONES en la pantalla "Entrenar IA", con la pantalla de verdad.
//
// Por qué existe: los tests de scripts/test-secciones.ts prueban la mecánica (que el texto
// entre al prompt). Esto prueba lo otro, que es donde se rompen estas cosas: que Mary VEA la
// caja, que al apretar Guardar quede guardada, que al volver a abrir siga ahí, y que si la
// deja vacía el bot vuelva a decir que no hay promociones en vez de quedarse con la vieja.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next dev -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:entrenar-pantalla

import { chromium } from 'playwright-core'
import Database from 'better-sqlite3'
import path from 'path'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''
const PROMO = 'PRUEBA 2x1 en la clase de prueba, hasta el 31 de agosto.'
const DE_FABRICA = 'Por ahora no hay promociones vigentes.'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { console.log(`  OK  ${m}`); pass++ } else { console.log(`  XX  ${m}`); fail++ } }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). Falta PANEL_PASSWORD?`)
  await browser.close(); process.exit(2)
}
const page = await ctx.newPage()
console.log('\nTEST la caja de promociones en Entrenar IA\n')

// Deja la base EXACTAMENTE como estaba, pase lo que pase. Se guarda la fila cruda y no lo que
// devuelve la pantalla: la pantalla muestra también los textos del repo, así que restaurar por
// ahí dejaría fijado como "editado por Mary" algo que ella nunca tocó.
const db = new Database(path.resolve(process.cwd(), 'data/messages.db'))
const fila = db.prepare("SELECT valor FROM config WHERE clave = 'secciones_negocio'").get()
const crudoAntes = fila ? fila.valor : null
function restaurarBase() {
  if (crudoAntes === null) db.prepare("DELETE FROM config WHERE clave = 'secciones_negocio'").run()
  else db.prepare("INSERT INTO config (clave, valor) VALUES ('secciones_negocio', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").run(crudoAntes)
}

async function cajaPromo() {
  const tarjeta = page.locator('div', { has: page.locator('span', { hasText: 'Promociones y descuentos' }) })
  return page.locator('textarea').nth(await indicePromo())
}
async function indicePromo() {
  // El orden de las cajas es el del prompt; la primera textarea es el saludo.
  return await page.evaluate(() => {
    const tit = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Promociones y descuentos')
    const tarjeta = tit.closest('div').parentElement
    const areas = [...document.querySelectorAll('textarea')]
    return areas.indexOf(tarjeta.querySelector('textarea'))
  })
}

try {
  await page.goto(BASE + '/configuracion', { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Entrenar IA')

  const titulo = page.locator('span', { hasText: 'Promociones y descuentos' })
  ok(await titulo.count() === 1, 'Mary ve la caja "Promociones y descuentos"')

  const caja = await cajaPromo()
  ok((await caja.inputValue()).length > 0, 'la caja viene con lo que sabe el bot, no vacía')

  await caja.fill(PROMO)
  await page.getByRole('button', { name: /Guardar cambios/ }).click()
  await page.waitForSelector('text=Guardado', { timeout: 8000 })
  ok(true, 'al apretar Guardar dice "Guardado"')

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=Promociones y descuentos')
  ok((await (await cajaPromo()).inputValue()) === PROMO, 'al volver a abrir, la promoción sigue escrita')

  const prompt1 = await (await ctx.request.get(BASE + '/api/config')).json()
  const bPromo = prompt1.bloques.find(b => b.clave === 'promociones')
  ok(bPromo?.contenido === PROMO, 'el bot recibe la promoción de Mary')

  // La deja vacía: tiene que volver el texto del repo, nunca quedarse con la promo vencida.
  await (await cajaPromo()).fill('')
  await page.getByRole('button', { name: /Guardar cambios/ }).click()
  await page.waitForSelector('text=Guardado', { timeout: 8000 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=Promociones y descuentos')
  ok((await (await cajaPromo()).inputValue()).includes(DE_FABRICA), 'si borra la promoción, vuelve el "no hay promociones vigentes"')
} finally {
  restaurarBase()
  db.close()
  await browser.close()
}

console.log(fail === 0 ? `\n${pass} passed, 0 failed\n` : `\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
