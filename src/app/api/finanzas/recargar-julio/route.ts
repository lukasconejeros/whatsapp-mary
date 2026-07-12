import { NextRequest, NextResponse } from "next/server";
import { importarCartola } from "@/lib/cartola";
import { borrarCartolaImportada } from "@/lib/db";

export const dynamic = "force-dynamic";
// TEMPORAL: borra la carga anterior de cartola y re-importa julio 2026 con la lógica
// nueva (ingresos por tipo + comisiones). Token. Quitar tras usar.
const TOKEN = "arteluk-recarga-jul-8m4";

const CARTOLA_JULIO = `
01-07-2026 10:44:30 Abono Liberación de dinero 166595332516 CLP 19.990,00 -532,00
01-07-2026 10:46:33 Abono Transferencia recibida 166651343068 CLP 60.000,00 0,00
01-07-2026 15:12:05 Abono Transferencia recibida 165858247629 CLP 160.000,00 0,00
01-07-2026 16:41:59 Abono Transferencia recibida 166712679346 CLP 60.000,00 0,00
02-07-2026 08:27:09 Abono Transferencia recibida 165963320989 CLP 60.000,00 0,00
02-07-2026 09:57:23 Abono Transferencia recibida 166818301270 CLP 205.000,00 0,00
02-07-2026 10:20:38 Cargo Transferencia enviada 166820411656 CLP -620.000,00 0,00
02-07-2026 12:53:22 Abono Transferencia recibida 166006880561 CLP 60.000,00 0,00
02-07-2026 13:35:10 Cargo Pago 166854987380 CLP -16.990,00 0,00
02-07-2026 13:43:38 Cargo Pago 166856029392 CLP -800,00 0,00
02-07-2026 15:54:39 Abono Transferencia recibida 166033906909 CLP 60.000,00 0,00
03-07-2026 14:25:28 Abono Transferencia recibida 167034592468 CLP 65.000,00 0,00
04-07-2026 10:50:41 Cargo Pago 166316929233 CLP -13.500,00 0,00
04-07-2026 17:47:52 Cargo Pago 166387318977 CLP -31.500,00 0,00
04-07-2026 18:08:31 Abono Transferencia recibida 166387003693 CLP 60.000,00 0,00
04-07-2026 19:14:49 Abono Transferencia recibida 166402510201 CLP 50.000,00 0,00
05-07-2026 22:20:40 Abono Transferencia recibida 166543539775 CLP 100.000,00 0,00
06-07-2026 11:26:43 Abono Transferencia recibida 167457349232 CLP 100.000,00 0,00
06-07-2026 11:42:20 Abono Transferencia recibida 166611129581 CLP 92.626,00 0,00
06-07-2026 12:10:03 Abono Transferencia recibida 166615969775 CLP 120.000,00 0,00
06-07-2026 13:29:32 Cargo Pago 167484241314 CLP -38.070,00 0,00
06-07-2026 13:56:01 Cargo Pago 166640220237 CLP -12.400,00 0,00
06-07-2026 14:25:13 Abono Transferencia recibida 167491355298 CLP 100.000,00 0,00
06-07-2026 22:06:46 Abono Transferencia recibida 166721864545 CLP 37.500,00 0,00
07-07-2026 09:11:43 Abono Transferencia recibida 167610288060 CLP 120.000,00 0,00
07-07-2026 15:19:21 Cargo Transferencia enviada 167679018376 CLP -120.000,00 0,00
07-07-2026 17:37:24 Abono Liberación de dinero 166849739873 CLP 120.000,00 -3.192,00
08-07-2026 13:54:45 Cargo Pago 167842580160 CLP -22.140,00 0,00
08-07-2026 19:49:50 Abono Transferencia recibida 167047465893 CLP 120.000,00 0,00
09-07-2026 09:10:49 Cargo Transferencia enviada 167964205444 CLP -900.000,00 0,00
09-07-2026 13:42:45 Cargo Pago 168008816106 CLP -25.470,00 0,00
09-07-2026 16:52:06 Abono Transferencia recibida 168034990614 CLP 60.000,00 0,00
09-07-2026 17:16:38 Cargo Pago 167184252597 CLP -7.900,00 0,00
09-07-2026 21:14:31 Abono Transferencia recibida 168074414948 CLP 60.000,00 0,00
10-07-2026 11:47:30 Abono Transferencia recibida 168153122406 CLP 19.990,00 0,00
10-07-2026 13:21:41 Cargo Pago 168169880786 CLP -16.360,00 0,00
`;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== TOKEN) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const borrado = borrarCartolaImportada();
  const r = importarCartola(CARTOLA_JULIO);
  return NextResponse.json({ ok: true, borrado, ...r });
}
