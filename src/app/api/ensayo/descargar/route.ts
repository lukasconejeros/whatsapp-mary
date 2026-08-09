import { NextResponse } from "next/server";
import { listEnsayoTodo, listAudiosMary } from "@/lib/db";
import { armarInforme } from "@/lib/ensayo";

export const dynamic = "force-dynamic";

// "Descargar todo": la tarde entera de entrenamiento, TODAS las prácticas, con las
// correcciones de Mary y sus audios. Es lo que leemos para armar el cerebro definitivo.
export async function GET() {
  const texto = armarInforme(listEnsayoTodo(), listAudiosMary());
  return new NextResponse(texto, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="entrenamiento-arteluk.txt"',
    },
  });
}
