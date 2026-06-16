import "./env-loader.js";
import { upsertIngresoFromAirtable, upsertCostoFromAirtable, upsertCliente } from "../src/lib/db.js";
import { currentMonth } from "../src/lib/finanzas.js";

const PAT  = process.env.AIRTABLE_PAT;
const BASE = process.env.ARTELUK_AIRTABLE_BASE ?? "appbYApKOA3rDvTJF";
const MES  = process.env.MIGRA_MES ?? currentMonth(); // 'YYYY-MM'

interface ATRecord { id: string; fields: Record<string, unknown> }

async function fetchTable(table: string): Promise<ATRecord[]> {
  const out: ATRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${PAT}` } });
    if (!res.ok) throw new Error(`Airtable ${table} ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as { records: ATRecord[]; offset?: string };
    out.push(...page.records);
    offset = page.offset;
  } while (offset);
  return out;
}

function str(v: unknown): string | undefined { return v == null ? undefined : String(v); }
function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

async function main() {
  if (!PAT) { console.error("Falta AIRTABLE_PAT en .env.local"); process.exit(1); }
  console.log(`\n📥 Migrando Airtable (base ${BASE}) — mes de finanzas: ${MES}\n`);

  // Ingresos del mes objetivo
  const ing = await fetchTable("Ingresos del mes");
  let ni = 0;
  for (const r of ing) {
    const fecha = str(r.fields["Fecha"]);
    if (!fecha || fecha.slice(0, 7) !== MES) continue;
    upsertIngresoFromAirtable({
      airtableId: r.id, fecha,
      apoderado: str(r.fields["Apoderados"]),
      monto: num(r.fields["Monto pagado"]),
      tipo: str(r.fields["Tipo"]),
      detalle: str(r.fields["Detalle"]),
    });
    ni++;
  }

  // Costos del mes objetivo
  const cos = await fetchTable("Costos y Gastos");
  let nc = 0;
  for (const r of cos) {
    const fecha = str(r.fields["Fecha"]);
    if (!fecha || fecha.slice(0, 7) !== MES) continue;
    upsertCostoFromAirtable({
      airtableId: r.id, fecha,
      tipo: str(r.fields["Tipo de Egresos"]),
      cantidad: r.fields["Cantidad"] == null ? undefined : num(r.fields["Cantidad"]),
      valor: num(r.fields["Valor"]),
      notas: str(r.fields["Notas"]),
    });
    nc++;
  }

  // Clientes (todos)
  const cli = await fetchTable("Sistema Arteluk");
  let ncli = 0, skip = 0;
  for (const r of cli) {
    const tel = str(r.fields["Numero de telefono"]);
    if (!tel) { skip++; continue; }
    const estado = r.fields["Inactivos"] ? "inactivo" : r.fields["vuelven "] ? "vuelve" : r.fields["Pagados"] ? "pagado" : undefined;
    const alumnosRaw = r.fields["Nombre del alumno"];
    const alumnos = Array.isArray(alumnosRaw) ? alumnosRaw.join(", ") : str(alumnosRaw);
    const horario = Array.isArray(r.fields["Horario"]) ? (r.fields["Horario"] as string[]) : undefined;
    const ok = upsertCliente({
      airtableId: r.id, telefono: tel,
      nombre: str(r.fields["Nombre del apoderado"]),
      email: str(r.fields["Correo"]),
      estado, horario, alumnos,
    });
    if (ok) ncli++; else skip++;
  }

  console.log(`✅ Ingresos (${MES}): ${ni}  |  Costos (${MES}): ${nc}  |  Clientes: ${ncli} (saltados ${skip})`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
