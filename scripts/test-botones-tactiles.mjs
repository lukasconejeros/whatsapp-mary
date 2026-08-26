// ¿Se puede apretar cada botón con el dedo en un iPhone?
//
// Lukas, 09-08-2026: "voy a la pestaña de bot o calendario y se pega, tengo que
// apretarlo varias veces". Medido con un iPhone 13 emulado: había botones de
// 18x18 y 27x27 px. Apple pide 44x44 como área mínima para el dedo; por debajo
// de eso el toque cae fuera y parece que la app "no responde".
//
// Este test recorre las pantallas del panel con el motor de Chromium en modo
// iPhone y FALLA si algún control táctil mide menos de 44x44, o si algo tapa el
// botón y el toque no le llega.
//
// Cómo correrlo:
//   1) levanta la app:  PANEL_PASSWORD=xxx npm run dev -- -p 3011
//   2) en otra consola: BASE=http://localhost:3011 PANEL_PASSWORD=xxx npm run test:botones
//
// En Windows (PowerShell):
//   $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="xxx"; npm run test:botones

import { chromium, webkit, devices } from 'playwright-core'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''
const MINIMO = 44 // px, mínimo táctil de iOS
// MOTOR=webkit usa el motor de Safari, que es el del iPhone de verdad.
const MOTOR = process.env.MOTOR === 'webkit' ? webkit : chromium

const RUTAS = (process.env.RUTAS || '/inbox,/finanzas,/calendario,/alumnos,/asistente,/ensayo,/conexion,/contactos,/metricas,/configuracion').split(',')

const browser = await MOTOR.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })

// Login por la API: la cookie queda en el contexto y no dependemos de que la
// pantalla de login haya hidratado (en modo dev tarda y el botón sigue apagado).
const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  await browser.close()
  process.exit(2)
}

const page = await ctx.newPage()
const problemas = []

for (const ruta of RUTAS) {
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  // Si la sesión no entró, la pantalla que se mide es el login: tres controles y
  // "todo verde" sin haber mirado nada. Mejor reventar que mentir.
  if (page.url().includes('/login')) {
    console.error(`\nNo hay sesión: ${ruta} rebotó al login. El test no mide nada así.`)
    await browser.close()
    process.exit(2)
  }
  // Y esperar a que la pantalla termine de cargar, o se miden cuatro controles
  // en vez de todos.
  await page.waitForFunction(() => !/Cargando/i.test(document.body.innerText), null, { timeout: 60000 })
    .catch(() => console.log('  (aviso: seguía cargando; se mide igual)'))
  await page.waitForTimeout(1500)

  const r = await page.evaluate((MINIMO) => {
    const desc = (el) => !el ? 'nada' :
      el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')

    // Controles de verdad: botones, enlaces del menú y enlaces con pinta de
    // botón. Los enlaces sueltos dentro de un párrafo son texto, no controles.
    const candidatos = [...document.querySelectorAll('button, [role="button"], nav a, a[href], input[type="checkbox"], input[type="radio"], select')]
    const esTextoInline = (el) => el.tagName === 'A' && !!el.closest('p, li, span') && !el.closest('nav')

    // Un elemento a medio desplazar dentro de una lista con scroll asoma sólo en
    // parte: su centro geométrico puede caer fuera de la lista y aterrizar sobre
    // la barra del menú. Eso NO es que algo lo tape, así que el toque se prueba
    // en el centro de lo que de verdad se ve.
    const trozoVisible = (el) => {
      let r = el.getBoundingClientRect()
      let top = r.top, left = r.left, bottom = r.bottom, right = r.right
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const est = getComputedStyle(p)
        if (est.overflow === 'visible' && est.overflowY === 'visible' && est.overflowX === 'visible') continue
        const pb = p.getBoundingClientRect()
        top = Math.max(top, pb.top); left = Math.max(left, pb.left)
        bottom = Math.min(bottom, pb.bottom); right = Math.min(right, pb.right)
      }
      top = Math.max(top, 0); left = Math.max(left, 0)
      bottom = Math.min(bottom, innerHeight); right = Math.min(right, innerWidth)
      return { top, left, bottom, right, width: right - left, height: bottom - top }
    }

    const chicos = [], tapados = []
    let revisados = 0

    for (const el of candidatos) {
      if (esTextoInline(el)) continue
      if (el.disabled) continue
      const b = el.getBoundingClientRect()
      if (b.width === 0 || b.height === 0) continue
      if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue
      const est = getComputedStyle(el)
      if (est.visibility === 'hidden' || est.display === 'none' || est.pointerEvents === 'none') continue
      const v = trozoVisible(el)
      if (v.width < 2 || v.height < 2) continue // recortado del todo: no se puede tocar
      revisados++

      const texto = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 24)

      if (b.height < MINIMO || b.width < MINIMO) {
        chicos.push({ el: desc(el), texto, px: `${Math.round(b.width)}x${Math.round(b.height)}` })
      }

      // Para probar el toque hacemos lo que haría una persona: desplazar el
      // botón a la vista. Si no, un control a medio subir por la lista parece
      // "tapado" por la barra de abajo cuando en realidad basta con deslizar.
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const t = trozoVisible(el)
      const recibe = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2)
      // nextjs-portal es el panel de herramientas del modo desarrollo: no existe
      // en producción, así que no cuenta como estorbo.
      const esOverlayDeDev = recibe && recibe.tagName.toLowerCase() === 'nextjs-portal'
      if (recibe && recibe !== el && !el.contains(recibe) && !esOverlayDeDev) {
        tapados.push({ el: desc(el), texto, loTapa: desc(recibe) })
      }
    }
    return { revisados, chicos, tapados, pantalla: `${innerWidth}x${innerHeight}` }
  }, MINIMO)

  console.log(`\n=== ${ruta} (pantalla ${r.pantalla}) · ${r.revisados} controles ===`)
  if (r.chicos.length) {
    console.log(`  ${r.chicos.length} por debajo de ${MINIMO}x${MINIMO}:`)
    for (const c of r.chicos) console.log(`    "${c.texto}" (${c.el}) = ${c.px}`)
  } else {
    console.log('  área táctil: todos por encima de 44x44 ✓')
  }
  if (r.tapados.length) {
    console.log(`  ${r.tapados.length} TAPADOS (el toque no llega):`)
    for (const t of r.tapados) console.log(`    "${t.texto}" (${t.el}) lo tapa: ${t.loTapa}`)
  }

  for (const c of r.chicos) problemas.push({ ruta, tipo: 'chico', ...c })
  for (const t of r.tapados) problemas.push({ ruta, tipo: 'tapado', ...t })
}

await browser.close()

console.log('\n────────────────────────────────')
if (problemas.length) {
  const chicos = problemas.filter(p => p.tipo === 'chico').length
  const tapados = problemas.filter(p => p.tipo === 'tapado').length
  console.log(`FALLA: ${chicos} controles por debajo de ${MINIMO}x${MINIMO} y ${tapados} tapados, en ${RUTAS.length} pantallas.`)
  process.exit(1)
}
console.log(`OK: todos los controles llegan a ${MINIMO}x${MINIMO} y ninguno queda tapado, en ${RUTAS.length} pantallas.`)
