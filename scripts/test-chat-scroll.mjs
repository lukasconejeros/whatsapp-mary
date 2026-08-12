// El scroll del chat del inbox no se escapa solo hacia abajo.
//
// Lukas, 11-08-2026: "en la app del compu no puedo ir para arriba con los mensajes
// en un chat: al segundo se desliza para abajo solo". Causa: el chat se refresca cada
// 7 s (ConversationView) y cada refresco bajaba al fondo aunque no hubiera nada nuevo.
//
// Lo que se comprueba, con la pantalla de verdad:
//   1. al abrir el chat, parte abajo (como siempre);
//   2. si Mary sube a leer, un refresco SIN mensajes nuevos no la mueve;
//   3. si llega un mensaje nuevo mientras está arriba leyendo, tampoco la arrastra;
//   4. si está abajo y llega un mensaje nuevo, el chat sí baja a mostrarlo.
//
// Cómo correrlo (PowerShell):
//   1) $env:PANEL_PASSWORD="test1234"; npx next start -p 3011
//   2) $env:BASE="http://localhost:3011"; $env:PANEL_PASSWORD="test1234"; npm run test:chat-scroll
//
// Ojo: espera ciclos reales del refresco de 7 s, así que tarda ~40 s.

import { chromium } from 'playwright-core'
import Database from 'better-sqlite3'
import path from 'path'

const BASE = process.env.BASE || 'http://localhost:3011'
const PASSWORD = process.env.PANEL_PASSWORD || ''
const NOMBRE = 'PRUEBA Scroll'
const FONO = '56900990099'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { console.log(`  ✅ ${m}`); pass++ } else { console.log(`  ❌ ${m}`); fail++ } }

// ── Siembra: un chat largo directo en la base (la misma que usa el server) ────
const db = new Database(path.resolve(process.cwd(), 'data/messages.db'))
function limpiar() {
  const conv = db.prepare('SELECT id FROM conversations WHERE phone = ?').get(FONO)
  if (conv) {
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conv.id)
    db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id)
  }
}
limpiar()
const ahora = Math.floor(Date.now() / 1000)
db.prepare(
  "INSERT INTO conversations (phone, name, mode, categoria, last_message_at) VALUES (?,?, 'HUMAN', 'mary', ?)"
).run(FONO, NOMBRE, ahora)
const convId = db.prepare('SELECT id FROM conversations WHERE phone = ?').get(FONO).id
const insMsg = db.prepare('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?,?,?,?)')
for (let i = 1; i <= 40; i++) {
  insMsg.run(convId, i % 2 ? 'user' : 'human', `PRUEBA mensaje ${i}`, ahora - (41 - i) * 60)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const login = await ctx.request.post(BASE + '/api/login', { data: { password: PASSWORD } })
if (!login.ok()) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status()}). ¿Falta PANEL_PASSWORD?`)
  limpiar(); db.close(); await browser.close(); process.exit(2)
}

const page = await ctx.newPage()
console.log('\n🧪 TEST el scroll del chat no se escapa solo\n')

await page.goto(BASE + '/inbox', { waitUntil: 'networkidle' })
await page.getByText(NOMBRE).first().click()
await page.getByText('PRUEBA mensaje 40', { exact: true }).waitFor({ timeout: 10_000 })
await page.waitForTimeout(1200) // que termine el scroll suave de la apertura

// El cajón que scrollea: el div con overflow-y auto que contiene los mensajes.
async function medir() {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d =>
      getComputedStyle(d).overflowY === 'auto' &&
      d.scrollHeight > d.clientHeight + 100 &&
      d.textContent.includes('PRUEBA mensaje 1'))
    if (!el) return null
    return { top: el.scrollTop, alto: el.clientHeight, total: el.scrollHeight }
  })
}
async function subirArriba() {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find(d =>
      getComputedStyle(d).overflowY === 'auto' &&
      d.scrollHeight > d.clientHeight + 100 &&
      d.textContent.includes('PRUEBA mensaje 1'))
    if (el) el.scrollTop = 0
  })
}

// 1 ── Abre abajo, como siempre.
let m = await medir()
ok(m !== null, 'se encontró el cajón de mensajes')
ok(m && m.top + m.alto >= m.total - 60, `al abrir el chat parte abajo (top=${m?.top})`)

// 2 ── Sube a leer; el refresco de los 7 s no la puede mover.
await subirArriba()
await page.waitForTimeout(9_000) // cubre un ciclo completo del refresco
m = await medir()
ok(m && m.top < 100, `tras 9 s arriba sigue arriba: el refresco sin novedades no la mueve (top=${m?.top})`)

// 3 ── Llega un mensaje nuevo mientras lee arriba: tampoco la arrastra.
insMsg.run(convId, 'user', 'PRUEBA mensaje nuevo estando arriba', Math.floor(Date.now() / 1000))
await page.waitForTimeout(9_000)
m = await medir()
ok(m && m.top < 100, `un mensaje nuevo con ella arriba leyendo no la arrastra (top=${m?.top})`)

// 4 ── Abajo de nuevo: un mensaje nuevo sí baja a mostrarse.
await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(d =>
    getComputedStyle(d).overflowY === 'auto' &&
    d.scrollHeight > d.clientHeight + 100 &&
    d.textContent.includes('PRUEBA mensaje 1'))
  if (el) el.scrollTop = el.scrollHeight
})
insMsg.run(convId, 'user', 'PRUEBA mensaje nuevo estando abajo', Math.floor(Date.now() / 1000))
await page.waitForTimeout(9_000)
m = await medir()
ok(m && m.top + m.alto >= m.total - 60, `estando abajo, el mensaje nuevo aparece y el chat baja con él (top=${m?.top})`)
ok(await page.getByText('PRUEBA mensaje nuevo estando abajo').isVisible(), 'el mensaje nuevo se ve en pantalla')

limpiar()
db.close()
await browser.close()
console.log(fail === 0 ? `\n🎉  ${pass} passed, 0 failed\n` : `\n💥  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
