// ¿Cada cuánto llegan los mensajes dentro de una misma conversación? (10-08-2026)
//
// De eso depende que la caché del prompt AHORRE o CUESTE: guardar en caché se paga
// un 25% más caro, leerla cuesta el 10%. Si entre un mensaje y el siguiente pasan
// más de 5 minutos, la caché ya expiró y se paga el recargo sin aprovecharla.
//
// Correr con: node scripts/medir-ritmo-cache.mjs
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.resolve(process.cwd(), 'data/messages.db'), { readonly: true })
const filas = db.prepare(
  "SELECT conversation_id, created_at FROM messages WHERE role='user' ORDER BY conversation_id, created_at"
).all()

const huecos = []
let prev = null
for (const f of filas) {
  if (prev && prev.conversation_id === f.conversation_id) {
    const seg = (new Date(f.created_at) - new Date(prev.created_at)) / 1000
    if (seg >= 0 && seg < 86400 * 7) huecos.push(seg)
  }
  prev = f
}

huecos.sort((a, b) => a - b)
const pct = (p) => huecos[Math.floor(huecos.length * p)] ?? 0
const bajo = (s) => huecos.filter((h) => h <= s).length
const n = huecos.length

console.log(`\nMensajes de apoderadas: ${filas.length} · pausas medidas: ${n}\n`)
if (n === 0) { console.log('Sin datos suficientes.'); process.exit(0) }
console.log(`  mediana entre mensajes: ${(pct(0.5) / 60).toFixed(1)} min`)
console.log(`  percentil 75: ${(pct(0.75) / 60).toFixed(1)} min`)
console.log(`  percentil 90: ${(pct(0.9) / 60).toFixed(1)} min\n`)
console.log(`  dentro de 5 min (acierta con caché corta): ${bajo(300)}/${n} = ${((bajo(300) / n) * 100).toFixed(0)}%`)
console.log(`  dentro de 1 hora (acierta con caché larga): ${bajo(3600)}/${n} = ${((bajo(3600) / n) * 100).toFixed(0)}%\n`)

const p5 = bajo(300) / n, p60 = bajo(3600) / n
console.log(`  Coste relativo por mensaje (1,00 = lo que se paga hoy):`)
console.log(`    hoy, sin caché: 1,00`)
console.log(`    caché 5 min:    ${(p5 * 0.1 + (1 - p5) * 1.25).toFixed(2)}`)
console.log(`    caché 1 hora:   ${(p60 * 0.1 + (1 - p60) * 2.0).toFixed(2)}\n`)
