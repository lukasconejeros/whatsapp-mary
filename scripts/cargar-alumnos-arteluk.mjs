// Carga los alumnos fijos de Mary desde sus planillas (fotos que mandó Lukas el
// 10-08-2026). La academia funciona LUNES, MARTES y MIÉRCOLES: él confirmó que
// jueves, viernes y sábado no tienen clases.
//
// Es IDEMPOTENTE: se puede correr las veces que haga falta. Identifica cada bloque
// por día + hora de inicio + hora de término; si ya existe, le actualiza los
// alumnos, y si no, lo crea. Nunca duplica ni borra lo que Mary haya agregado.
//
// Correr contra el panel local:
//   $env:BASE="http://localhost:3013"; $env:PANEL_PASSWORD="test1234"; npm run cargar:alumnos
// Contra producción:
//   $env:BASE="https://n8n-arteluk.bvil2a.easypanel.host"; $env:PANEL_PASSWORD="…"; npm run cargar:alumnos

const BASE = process.env.BASE || 'http://localhost:3013'
const PASSWORD = process.env.PANEL_PASSWORD || ''

// Tal cual las planillas. La profe no aparece en ellas: se deja Mary, que es lo
// más probable, y ella lo corrige desde la pantalla si alguna es de Paula.
const PLANILLA = [
  { dia: 'Lunes',     hora: '16:00', horaFin: '17:00', alumnos: ['Alison', 'Amelia', 'Amparo'] },
  { dia: 'Lunes',     hora: '17:30', horaFin: '19:30', alumnos: ['Mateo', 'Matilda', 'Noah', 'Antonia Pontigo', 'Ignacia'] },
  { dia: 'Lunes',     hora: '18:30', horaFin: '19:30', alumnos: ['Julieta Bratz', 'Noah'] },
  { dia: 'Martes',    hora: '17:30', horaFin: '19:30', alumnos: ['Mateo'] },
  { dia: 'Martes',    hora: '17:30', horaFin: '18:30', alumnos: ['Aurora'] },
  { dia: 'Miercoles', hora: '17:30', horaFin: '19:30', alumnos: ['Rafaela Estay', 'Maite Muñoz', 'Josefina Tomckowiack', 'Gabriela Martínez'] },
  { dia: 'Miercoles', hora: '18:30', horaFin: '19:30', alumnos: ['Valentina Roa', 'Sofía'] },
]

const login = await fetch(BASE + '/api/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD }),
})
if (!login.ok) {
  console.error(`No se pudo entrar al panel (HTTP ${login.status}). ¿Falta PANEL_PASSWORD?`)
  process.exit(2)
}
const cookie = (login.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
const cab = { 'Content-Type': 'application/json', cookie }

const existentes = (await (await fetch(BASE + '/api/clases-fijas', { headers: { cookie } })).json()).clasesFijas ?? []
console.log(`Ya había ${existentes.length} clases fijas en ${BASE}\n`)

let creadas = 0, actualizadas = 0, iguales = 0
for (const b of PLANILLA) {
  const ya = existentes.find(e => e.dia === b.dia && e.hora === b.hora && (e.horaFin ?? null) === b.horaFin)
  const cuerpo = { ...b, profe: ya?.profe || 'Mary', cuposPrueba: ya?.cuposPrueba ?? 0, activa: true }
  if (!ya) {
    const r = await (await fetch(BASE + '/api/clases-fijas', { method: 'POST', headers: cab, body: JSON.stringify(cuerpo) })).json()
    if (!r.ok) { console.error(`  ❌ ${b.dia} ${b.hora}: ${r.error}`); process.exit(1) }
    console.log(`  + ${b.dia} ${b.hora}-${b.horaFin}: ${b.alumnos.join(', ')}`)
    creadas++
  } else if (JSON.stringify(ya.alumnos) !== JSON.stringify(b.alumnos)) {
    const r = await (await fetch(`${BASE}/api/clases-fijas/${ya.id}`, { method: 'PUT', headers: cab, body: JSON.stringify(cuerpo) })).json()
    if (!r.ok) { console.error(`  ❌ ${b.dia} ${b.hora}: ${r.error}`); process.exit(1) }
    console.log(`  ~ ${b.dia} ${b.hora}-${b.horaFin}: alumnos actualizados`)
    actualizadas++
  } else {
    iguales++
  }
}

const fin = (await (await fetch(BASE + '/api/clases-fijas', { headers: { cookie } })).json()).clasesFijas ?? []
console.log(`\n${creadas} creadas · ${actualizadas} actualizadas · ${iguales} ya estaban igual`)
console.log(`Total de clases fijas ahora: ${fin.length}`)
for (const d of ['Lunes', 'Martes', 'Miercoles']) {
  const delDia = fin.filter(f => f.dia === d).sort((a, b) => a.hora.localeCompare(b.hora))
  console.log(`  ${d}: ` + (delDia.map(f => `${f.hora}-${f.horaFin} (${f.alumnos.length})`).join(' · ') || '—'))
}
