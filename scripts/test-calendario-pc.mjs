// ¿El calendario del computador se sale de los días?
//
// Lukas, 09-08-2026: "el calendario se ve mal en el computador". En su captura,
// «Exposición en casa prochelle» (miércoles 29) invadía el jueves, y «centro
// médico en el sector tirobayo» (lunes 3) invadía el martes.
//
// Causa: la grilla del mes se armaba con `repeat(7, 1fr)`, y una columna `1fr`
// NO puede encoger por debajo de su contenido (su min-width es `auto`). Con un
// título largo la columna se ensancha, empuja a las de al lado y el texto asoma
// encima del día siguiente. El mismo fallo que ya se arregló en la app de Lukas.
//
// Este test crea dos clases con títulos largos y FALLA si las 7 columnas dejan
// de medir lo mismo o si alguna etiqueta se sale de su día.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npm run dev -- -p 3013
//   2) $env:BASE="http://localhost:3013"; $env:PANEL_PASSWORD="test1234"; npm run test:calendario

import { chromium, webkit } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3013'
const PASSWORD = process.env.PANEL_PASSWORD || ''
const MOTOR = process.env.MOTOR === 'webkit' ? webkit : chromium
const TOLERANCIA = 1 // px

// Títulos largos de verdad, los mismos que se le salieron a él en la captura.
const LARGOS = ['Exposición en casa prochelle', 'centro médico en el sector tirobayo']

const browser = await MOTOR.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  await browser.close()
  process.exit(2)
}

// Dos días del mes en curso, en semanas distintas, como en su captura.
const hoy = new Date()
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
const fechas = [new Date(hoy.getFullYear(), hoy.getMonth(), 4), new Date(hoy.getFullYear(), hoy.getMonth(), 12)].map(ymd)

const creadas = []
let problemas = []

try {
  for (let i = 0; i < fechas.length; i++) {
    const r = await ctx.request.post(BASE + '/api/clases', {
      data: { fecha: fechas[i], dia: DIAS_SEMANA[new Date(`${fechas[i]}T12:00:00`).getDay()], profe: 'Mary', hora: '19:00', alumnos: [], nota: LARGOS[i] },
    })
    const d = await r.json()
    if (!d.ok) throw new Error(`No se pudo crear la clase de prueba: ${JSON.stringify(d)}`)
    creadas.push(d.clase?.id ?? d.id)
  }

  const page = await ctx.newPage()
  await page.goto(BASE + '/calendario', { waitUntil: 'domcontentloaded' })
  if (page.url().includes('/login')) throw new Error('No hay sesión: rebotó al login. Así no se mide nada.')
  await page.waitForSelector('.cal-cell', { timeout: 60000 })
  await page.waitForFunction(() => !/Cargando/i.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(800)

  const r = await page.evaluate(() => {
    const celdas = [...document.querySelectorAll('.cal-cell')]
    // Anchos de las 7 columnas: la primera fila de la grilla.
    const anchos = celdas.slice(0, 7).map(c => Math.round(c.getBoundingClientRect().width * 100) / 100)

    // Etiquetas que se salen de su propio día.
    const desbordes = []
    for (const celda of celdas) {
      const cb = celda.getBoundingClientRect()
      for (const ev of celda.querySelectorAll('.cal-ev-full > span')) {
        const eb = ev.getBoundingClientRect()
        const sobra = Math.max(eb.right - cb.right, cb.left - eb.left)
        if (sobra > 1) desbordes.push({ texto: (ev.textContent || '').trim().slice(0, 40), sobra: Math.round(sobra) })
      }
    }

    // La grilla completa tampoco puede salirse de su contenedor.
    const grid = document.querySelector('.cal-grid')
    const caja = grid?.getBoundingClientRect()
    const scrollX = document.documentElement.scrollWidth - document.documentElement.clientWidth

    return { anchos, desbordes, gridAncho: caja ? Math.round(caja.width) : 0, scrollX, celdas: celdas.length }
  })

  const min = Math.min(...r.anchos), max = Math.max(...r.anchos)
  const dif = Math.round((max - min) * 100) / 100

  console.log(`\n=== Calendario en computador (1440x900) · ${r.celdas} días dibujados ===`)
  console.log(`  Anchos de las 7 columnas: ${r.anchos.join(' · ')}`)
  console.log(`  Diferencia entre la más ancha y la más angosta: ${dif} px`)
  console.log(`  Etiquetas que se salen de su día: ${r.desbordes.length}`)
  for (const d of r.desbordes) console.log(`    "${d.texto}" se sale ${d.sobra} px`)
  console.log(`  Scroll horizontal de la página: ${r.scrollX} px`)

  if (dif > TOLERANCIA) problemas.push(`las 7 columnas no miden lo mismo (${dif} px de diferencia)`)
  if (r.desbordes.length) problemas.push(`${r.desbordes.length} etiquetas se salen de su día`)
  if (r.scrollX > TOLERANCIA) problemas.push(`la página se puede desplazar a lo ancho (${r.scrollX} px)`)
} finally {
  // Las clases de prueba se borran siempre, aunque el test reviente.
  for (const id of creadas) {
    if (id) await ctx.request.delete(`${BASE}/api/clases/${id}`).catch(() => {})
  }
  await browser.close()
}

console.log('\n────────────────────────────────')
if (problemas.length) {
  console.log('FALLA: ' + problemas.join(' · '))
  process.exit(1)
}
console.log('OK: las 7 columnas miden lo mismo y ninguna clase se sale de su día.')
