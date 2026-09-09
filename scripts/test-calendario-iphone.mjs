// El calendario del teléfono, calcado del Calendario de iOS (Lukas, 27-08-2026:
// "quiero que sea igual a la foto que te envié", una captura de Agosto 2026).
//
// Lo que la referencia manda, y que ANTES no se cumplía en el teléfono:
//   (1) el mes va arriba, grande y en negrita
//   (2) los días de la semana salen L M M J V S D, con sábado y domingo en gris
//   (3) la rejilla separa las SEMANAS con una línea; entre días NO hay líneas verticales
//   (4) [CAMBIADO el 08-09-2026] la celda vuelve a ser compacta y lleva UN SOLO punto:
//       verde si ese día solo hay clases de Mary, morado si solo son de Paula, partido
//       por la mitad si están las dos. Los nombres, a un toque, en el detalle del día.
//   (5) hoy = número blanco dentro de un círculo lleno
//   (6) los días de otro mes salen en gris
// Y lo que NO puede cambiar: en el computador la vista sigue como estaba.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; node scripts/test-calendario-iphone.mjs

import { chromium } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''

let pass = 0, fail = 0
const ok = (c, m, extra = '') => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m} ${extra}`); fail++ } }

// Convierte 'rgb(0, 168, 132)' → [0,168,132]; sirve para comparar colores sin pelearse
// con el formato exacto que devuelva el navegador.
const rgb = (s) => (s.match(/\d+/g) || []).map(Number)
const esGris = (c) => { const [r, g, b] = rgb(c); return Math.abs(r - g) < 18 && Math.abs(g - b) < 18 }
const transparente = (c) => c === 'transparent' || rgb(c)[3] === 0 || /rgba\(0, 0, 0, 0\)/.test(c)

const browser = await chromium.launch()

// El navegador del teléfono: el iPhone de Mary.
const tel = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const login = await tel.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) { console.error(`No se pudo entrar (HTTP ${login.status()})`); await browser.close(); process.exit(2) }

console.log('\n🧪 TEST el calendario del teléfono, calcado del iPhone\n')

try {
  const page = await tel.newPage()
  await page.goto(`${BASE}/calendario`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.cal-cell', { timeout: 15000 })

  // ── (1) El mes, arriba y grande ────────────────────────────────────────────
  console.log('El título del mes')
  const titulo = page.locator('[data-mes-titulo]')
  ok(await titulo.count() > 0, 'existe el título del mes')
  if (await titulo.count() > 0) {
    const st = await titulo.evaluate(el => getComputedStyle(el))
    ok(parseFloat(st.fontSize) >= 26, `el mes va grande (${st.fontSize})`, st.fontSize)
    ok(parseInt(st.fontWeight, 10) >= 700, `el mes va en negrita (${st.fontWeight})`, st.fontWeight)
    const txt = (await titulo.innerText()).toLowerCase()
    ok(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/.test(txt),
      `dice el nombre del mes ("${txt}")`, txt)
  }

  // ── (2) La cabecera L M M J V S D ──────────────────────────────────────────
  console.log('\nLos días de la semana')
  const dows = page.locator('[data-dow]')
  ok(await dows.count() === 7, 'hay 7 columnas', String(await dows.count()))
  const letras = (await dows.allInnerTexts()).map(s => s.trim())
  ok(letras.join('') === 'LMMJVSD', `salen como en el iPhone: ${letras.join(' ')}`, letras.join(' '))
  const colorSab = await dows.nth(5).evaluate(el => getComputedStyle(el).color)
  const colorLun = await dows.nth(0).evaluate(el => getComputedStyle(el).color)
  ok(esGris(colorSab), `el sábado va en gris (${colorSab})`, colorSab)
  ok(colorSab !== colorLun, 'el fin de semana se ve distinto del resto', `${colorSab} vs ${colorLun}`)

  // ── (3) Líneas solo entre semanas ──────────────────────────────────────────
  console.log('\nLas líneas de la rejilla')
  const celdas = page.locator('.cal-cell')
  const total = await celdas.count()
  ok(total >= 28 && total % 7 === 0, `la rejilla trae semanas completas (${total} celdas)`, String(total))
  // Una celda que NO es fin de semana: no debe tener línea a la derecha.
  const bordeDer = await celdas.nth(1).evaluate(el => getComputedStyle(el).borderRightWidth)
  ok(parseFloat(bordeDer) === 0, `no hay líneas verticales entre días (${bordeDer})`, bordeDer)
  // La primera fila sí separa de la siguiente semana.
  const bordeAbajo = await celdas.nth(0).evaluate(el => getComputedStyle(el).borderBottomWidth)
  ok(parseFloat(bordeAbajo) > 0, `las semanas van separadas por una línea (${bordeAbajo})`, bordeAbajo)

  // ── (4) UN SOLO PUNTO por día ──────────────────────────────────────────────
  // ⚠️ REGLA NUEVA, 08-09-2026. Hasta hoy acá se exigía justo lo contrario: celda
  // alta (≥90 px) con las etiquetas ESCRITAS dentro, que fue lo que Lukas pidió el
  // 27-08. Lo miró un mes en el teléfono de su mamá y lo cambió: "que no esté lleno
  // de puntos, busca una forma más minimalista, como solo un punto mitad morado y
  // verde… cada bloque se ve muy recargado". Los nombres siguen a un toque, en el
  // detalle del día, y en el COMPUTADOR no cambia nada (se comprueba más abajo).
  console.log('\nLas celdas y su punto único')
  const alto = (await celdas.nth(0).boundingBox())?.height ?? 0
  ok(alto >= 50 && alto <= 82, `la celda vuelve a ser compacta (${Math.round(alto)}px)`, String(alto))

  // Nada de píldoras escritas dentro de la celda en el teléfono.
  const pildoras = await page.locator('.cal-cell [data-ev]:visible').count()
  ok(pildoras === 0, `ninguna etiqueta escrita dentro de la celda (${pildoras})`, String(pildoras))

  const conPunto = page.locator('.cal-cell [data-punto]:visible')
  const cuantos = await conPunto.count()
  ok(cuantos > 0, `hay días con su punto (${cuantos})`, String(cuantos))
  if (cuantos > 0) {
    // Un punto por día como mucho: la queja era justamente "está lleno de puntos".
    const maxPorCelda = await page.locator('.cal-cell').evaluateAll(els =>
      Math.max(0, ...els.map(el => el.querySelectorAll('[data-punto]').length)))
    ok(maxPorCelda <= 1, `ningún día tiene más de un punto (máximo ${maxPorCelda})`, String(maxPorCelda))

    // Y el color dice de quién es: verde Mary, morado Paula, partido si están las dos.
    const claves = await conPunto.evaluateAll(els => els.map(el => el.getAttribute('data-punto')))
    const validas = claves.every(c => ['mary', 'paula', 'mixto', 'sin-profe'].includes(c))
    ok(validas, `cada punto dice de quién es la clase (${[...new Set(claves)].join(', ')})`, JSON.stringify(claves.slice(0, 6)))

    const fondos = await conPunto.evaluateAll(els => els.map(el => ({
      clave: el.getAttribute('data-punto'),
      fondo: getComputedStyle(el.firstElementChild).backgroundImage + ' | ' + getComputedStyle(el.firstElementChild).backgroundColor,
    })))
    const mixtos = fondos.filter(f => f.clave === 'mixto')
    if (mixtos.length > 0) {
      const partido = mixtos.every(f => /gradient/.test(f.fondo) && /168, 132/.test(f.fondo) && /139, 92, 246/.test(f.fondo))
      ok(partido, `el día con las dos profesoras va mitad verde y mitad morado (${mixtos.length})`, JSON.stringify(mixtos[0]))
    } else {
      console.log('  ℹ️ ningún día de este mes tiene a las dos profesoras: no se puede medir el punto partido')
    }
    const solas = fondos.filter(f => f.clave === 'mary' || f.clave === 'paula')
    if (solas.length > 0) {
      const enteros = solas.every(f => !/gradient/.test(f.fondo))
      ok(enteros, `los días de una sola profesora llevan el punto de un color (${solas.length})`, JSON.stringify(solas[0]))
    }
  }
  // El mes no puede salir dos veces (arriba entre las flechas Y grande abajo).
  const veces = await page.locator(':visible', { hasText: /^Agosto/ }).count()
  const barra = await page.locator('.cal-mes-barra:visible').count()
  ok(barra === 0, `el mes no se repite en la barra de arriba (${barra})`, String(barra) + ' / ' + String(veces))
  // Los puntitos sueltos de la versión vieja ya no se usan.
  const dotsVisibles = await page.locator('.cal-ev-dots:visible').count()
  ok(dotsVisibles === 0, `ya no quedan los puntitos sueltos de antes (${dotsVisibles})`, String(dotsVisibles))

  // ── (5) Hoy, en círculo lleno ──────────────────────────────────────────────
  console.log('\nEl día de hoy')
  const hoyNum = page.locator('[data-hoy-num]')
  if (await hoyNum.count() > 0) {
    const st = await hoyNum.evaluate(el => getComputedStyle(el))
    ok(!transparente(st.backgroundColor), `hoy va dentro de un círculo lleno (${st.backgroundColor})`, st.backgroundColor)
    const [r, g, b] = rgb(st.color)
    ok(r > 230 && g > 230 && b > 230, `el número de hoy va blanco (${st.color})`, st.color)
    ok(parseFloat(st.borderRadius) >= 12, `el círculo es redondo (${st.borderRadius})`, st.borderRadius)
  } else {
    ok(false, 'no se encontró el número de hoy (¿el mes en pantalla no es el de hoy?)')
  }

  // ── (6) Los días de otro mes, en gris ──────────────────────────────────────
  console.log('\nLos días del mes de al lado')
  const fuera = page.locator('.cal-cell[data-fuera-mes="1"]').first()
  if (await fuera.count() > 0) {
    const c = await fuera.locator('[data-num]').first().evaluate(el => getComputedStyle(el).color)
    ok(esGris(c), `los días de otro mes van en gris (${c})`, c)
  } else {
    ok(true, 'este mes calza justo y no asoma ningún día de al lado')
  }

  // ── (7) Sigue funcionando lo de siempre ────────────────────────────────────
  console.log('\nLo que NO se podía romper')
  await celdas.nth(10).click()
  await page.waitForTimeout(300)
  ok(await page.locator('.cal-detail').isVisible(), 'al tocar un día sigue apareciendo su detalle abajo')
  ok(await page.locator('.cal-detail').count() === 1, 'el detalle del día sigue existiendo una sola vez')

  await page.screenshot({ path: 'scripts/fixtures/calendario-iphone.png', fullPage: false })
  console.log('\n  📸 captura en scripts/fixtures/calendario-iphone.png')

  // ── (8) El computador NO cambia ────────────────────────────────────────────
  console.log('\nEl computador, que no se toca')
  const pc = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await pc.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
  const pagePc = await pc.newPage()
  await pagePc.goto(`${BASE}/calendario`, { waitUntil: 'networkidle' })
  await pagePc.waitForSelector('.cal-cell', { timeout: 15000 })
  const altoPc = (await pagePc.locator('.cal-cell').nth(0).boundingBox())?.height ?? 0
  ok(altoPc >= 90, `en el computador la celda sigue alta (${Math.round(altoPc)}px)`, String(altoPc))
  ok(await pagePc.locator('.cal-detail').isVisible(), 'en el computador el detalle sigue al costado')
  const evPc = await pagePc.locator('[data-ev]:visible').count()
  ok(evPc > 0, `en el computador se siguen viendo las clases escritas (${evPc})`, String(evPc))
  // La hora se escondió SOLO en el teléfono: en el computador la celda es ancha y
  // ahí sí cabe, así que no se puede haber perdido de las dos.
  const horaPc = await pagePc.locator('.cal-ev-hora:visible').count()
  ok(horaPc > 0, `en el computador la hora de la clase sigue a la vista (${horaPc})`, String(horaPc))
  // En el computador la celda es ancha: ahí siguen los NOMBRES, no el resumen corto.
  const largoPc = await pagePc.locator('.cal-ev-largo:visible').count()
  const cortoPc = await pagePc.locator('.cal-ev-corto:visible').count()
  ok(largoPc > 0 && cortoPc === 0, `en el computador siguen los nombres de los alumnos (${largoPc} nombres, ${cortoPc} resúmenes)`, `${largoPc}/${cortoPc}`)
  const textoPc = (await pagePc.locator('[data-ev]').first().innerText()).trim()
  ok(/[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,}/.test(textoPc), `y se leen de verdad ("${textoPc}")`, textoPc)
  const barraPc = await pagePc.locator('.cal-mes-barra:visible').count()
  ok(barraPc === 1, 'en el computador el mes sigue en la barra de arriba', String(barraPc))
  await pagePc.screenshot({ path: 'scripts/fixtures/calendario-computador.png', fullPage: false })
  console.log('  📸 captura en scripts/fixtures/calendario-computador.png')
  await pc.close()

} finally {
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail}\n`)
process.exit(fail === 0 ? 0 : 1)
