// El enganche del comprobante con el alumno, POR HTTP y TOCANDO LA PANTALLA de verdad.
//
// Lo que tiene que quedar demostrado, no supuesto:
//   · la bandeja de comprobantes le propone a Mary de quién es el pago,
//   · al aprobar con un alumno elegido, ese alumno queda con su mes pagado,
//   · sin elegir a nadie se comporta como siempre (solo el ingreso),
//   · y la API no acepta basura en el alumno ni en el mes.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:enganche-api

import { chromium } from 'playwright-core'
import Database from 'better-sqlite3'
import path from 'path'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''
const TEL = '56990008041'
const TEL2 = '56990008042'   // otra casa, para probar la pantalla con un caso limpio
const T = 'ZZEnganche '

let pass = 0, fail = 0
const ok = (c, m, extra = '') => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m} ${extra}`); fail++ } }

const db = new Database(path.resolve(process.cwd(), 'data/messages.db'))
const MES = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }).slice(0, 7)
const HOY = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })

function limpiar() {
  for (const tel of [TEL, TEL2]) {
    const c = db.prepare('SELECT id FROM conversations WHERE phone=?').get(tel)
    if (c) {
      db.prepare('DELETE FROM comprobantes WHERE conversation_id=?').run(c.id)
      db.prepare('DELETE FROM messages WHERE conversation_id=?').run(c.id)
      db.prepare('DELETE FROM conversations WHERE id=?').run(c.id)
    }
  }
  db.prepare("DELETE FROM ingresos WHERE detalle LIKE '%TEST-ENGANCHE-API%'").run()
  for (const a of db.prepare("SELECT id FROM alumnos WHERE nombre LIKE ?").all(T + '%')) {
    db.prepare('DELETE FROM mensualidades WHERE alumno_id=?').run(a.id)
    db.prepare('DELETE FROM inscripciones WHERE alumno_id=?').run(a.id)
    db.prepare('DELETE FROM ausencias WHERE alumno_id=?').run(a.id)
    db.prepare('DELETE FROM alumnos WHERE id=?').run(a.id)
  }
}
limpiar()

const convId = db.prepare('INSERT INTO conversations (phone, name) VALUES (?,?)').run(TEL, 'ZZ Apoderada').lastInsertRowid
const convId2 = db.prepare('INSERT INTO conversations (phone, name) VALUES (?,?)').run(TEL2, 'ZZ Apoderada Dos').lastInsertRowid
const nuevoComprobante = (monto, conv = convId) => db.prepare(
  `INSERT INTO comprobantes (conversation_id, media, monto, fecha, nombre, banco, esperado, de_meta)
   VALUES (?,?,?,?,?,?,?,?)`
).run(conv, null, monto, HOY, 'ZZ Apoderada', 'BancoEstado', 1, 0).lastInsertRowid

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  await browser.close(); process.exit(2)
}

const ficha = async (id) => {
  const d = await (await ctx.request.get(`${BASE}/api/alumnos?mes=${MES}`)).json()
  return d.alumnos.find(a => a.id === id)
}

console.log('\n🧪 TEST del enganche por HTTP y en pantalla\n')

try {
  const alta = await ctx.request.post(`${BASE}/api/alumnos`, { data: { nombre: `${T}Sofia`, telefono: TEL, mensualidad: 60000 } })
  const alumno = (await alta.json()).id
  await ctx.request.post(`${BASE}/api/alumnos/${alumno}/inscripciones`, { data: { dia: 'Lunes', hora: '17:30', horaFin: '18:30', profe: 'Mary' } })

  console.log('1) La bandeja propone de quién es el pago')
  const idProp = nuevoComprobante(60000)
  const lista = await (await ctx.request.get(`${BASE}/api/comprobantes`)).json()
  const mio = lista.comprobantes.find(c => c.id === idProp)
  ok(mio !== undefined, 'el comprobante aparece en la bandeja')
  ok(mio?.propuesta?.elegido?.alumnoIds?.join() === String(alumno), 'y viene con la alumna de ese teléfono propuesta', JSON.stringify(mio?.propuesta?.elegido))
  ok(mio?.propuesta?.mes === MES, 'con el mes del pago', String(mio?.propuesta?.mes))
  ok(Array.isArray(lista.alumnos) && lista.alumnos.some(a => a.id === alumno), 'y la lista de alumnos para poder cambiarlo a mano')

  console.log('\n2) Aprobar con la alumna elegida le deja el mes pagado')
  const r = await (await ctx.request.post(`${BASE}/api/comprobantes/${idProp}`, {
    data: { accion: 'aprobar', monto: 60000, detalle: 'TEST-ENGANCHE-API', alumnoIds: [alumno], mes: MES },
  })).json()
  ok(r.ok === true, 'la API acepta el enganche', JSON.stringify(r))
  const f1 = await ficha(alumno)
  ok(f1?.pago.estado === 'pagado', 'la ficha de la alumna queda pagada', JSON.stringify(f1?.pago))
  ok(f1?.pago.pagado === 60000, 'con los 60.000 de la transferencia', JSON.stringify(f1?.pago))

  console.log('\n3) Sin elegir a nadie, todo sigue como antes')
  const idSuelto = nuevoComprobante(20000)
  const otra = (await (await ctx.request.post(`${BASE}/api/alumnos`, { data: { nombre: `${T}Otra`, mensualidad: 60000 } })).json()).id
  const r2 = await (await ctx.request.post(`${BASE}/api/comprobantes/${idSuelto}`, {
    data: { accion: 'aprobar', monto: 20000, detalle: 'TEST-ENGANCHE-API' },
  })).json()
  ok(r2.ok === true && r2.ingresoId > 0, 'el ingreso se crea igual', JSON.stringify(r2))
  const f2 = await ficha(otra)
  ok(f2?.pago.estado !== 'pagado', 'y no se le inventa el pago a nadie', JSON.stringify(f2?.pago))

  console.log('\n4) Lo que la API NO debe aceptar')
  const idMalo = nuevoComprobante(60000)
  ok((await ctx.request.post(`${BASE}/api/comprobantes/${idMalo}`, { data: { accion: 'aprobar', alumnoIds: ['pepe'], mes: MES } })).status() === 400,
     'un alumno que no es un número responde 400')
  ok((await ctx.request.post(`${BASE}/api/comprobantes/${idMalo}`, { data: { accion: 'aprobar', alumnoIds: [alumno], mes: '2026-13' } })).status() === 400,
     'un mes inventado responde 400')

  console.log('\n5) A quien YA pagó no se le preselecciona otro pago del mismo mes')
  const yaPago = await (await ctx.request.get(`${BASE}/api/comprobantes`)).json()
  const delQueYaPago = yaPago.comprobantes.find(c => c.id === idMalo)
  ok(delQueYaPago?.propuesta?.elegido === null, 'nadie viene preseleccionado si la alumna ya pagó el mes', JSON.stringify(delQueYaPago?.propuesta?.elegido))
  ok(delQueYaPago?.propuesta?.candidatos?.[0]?.avisos?.some(a => /ya pag/i.test(a)) === true, 'y se la ofrece con el aviso «ya pagó»', JSON.stringify(delQueYaPago?.propuesta?.candidatos?.[0]?.avisos))

  console.log('\n6) La pantalla de verdad (lo que ve Mary)')
  const limpia = (await (await ctx.request.post(`${BASE}/api/alumnos`, { data: { nombre: `${T}Pantalla`, telefono: TEL2, mensualidad: 60000 } })).json()).id
  const idPantalla = nuevoComprobante(60000, convId2)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/finanzas`, { waitUntil: 'networkidle' })
  const tarjeta = page.locator(`.comp-card[data-comp-id="${idPantalla}"]`)
  const selector = tarjeta.locator('select[aria-label="¿De quién es este pago?"]')
  ok(await selector.count() > 0, 'la tarjeta trae el selector de alumno')
  const elegido = await selector.inputValue().catch(() => '')
  ok(elegido !== '', 'con alguien ya preseleccionado, para que sea un toque', `valor "${elegido}"`)
  const texto = await tarjeta.innerText()
  ok(/tel[eé]fono|nombre/i.test(texto), 'y dice POR QUÉ se propone a esa persona', texto.replace(/\n/g, ' | ').slice(0, 200))

  const cardDudosa = page.locator(`.comp-card[data-comp-id="${idMalo}"]`)
  const avisoDudoso = await cardDudosa.innerText()
  ok(/elige|elegir/i.test(avisoDudoso), 'cuando NO hay preseleccionado, la tarjeta le pide a Mary que elija', avisoDudoso.replace(/\n/g, ' | ').slice(0, 220))

  await page.screenshot({ path: 'scripts/fixtures/comprobante-enganche.png', fullPage: false })
  console.log('  📸 scripts/fixtures/comprobante-enganche.png')

  await tarjeta.locator('.comp-aprobar').click()
  await page.waitForTimeout(1500)
  const f3 = await ficha(limpia)
  ok(f3?.pago.pagado === 60000, 'aprobar DESDE LA PANTALLA le marca el pago a la alumna', JSON.stringify(f3?.pago))
  ok(f3?.pago.estado === 'pagado', 'y su mes queda pagado', JSON.stringify(f3?.pago))

  await page.close()
} finally {
  limpiar()
  await browser.close()
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pasaron, ${fail} fallaron\n`)
process.exit(fail === 0 ? 0 : 1)
