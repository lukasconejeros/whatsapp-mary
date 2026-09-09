// Lo que contestó la gente, ya resumido por pregunta para que Mary lo lea de un vistazo.
import { NextResponse } from "next/server";
import { getFormulario, listRespuestasFormulario, listEnviosFormulario } from "@/lib/db";
import { respuestaEnTexto } from "@/lib/formularios";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = getFormulario(parseInt(id, 10));
  if (!f) return NextResponse.json({ ok: false, error: "No existe ese formulario" }, { status: 404 });

  const respuestas = listRespuestasFormulario(f.id);
  const envios = listEnviosFormulario(f.id);

  // Resumen por pregunta: en las de opción, cuántos eligieron cada una; en las de
  // texto, la lista de lo que escribieron. Es lo que hace que 40 respuestas se
  // entiendan sin abrirlas una por una.
  const resumen = f.preguntas.map((p) => {
    const valores = respuestas.map((r) => r.respuestas[p.id]).filter((v) => v !== undefined && v !== null);
    if (p.tipo === "una-opcion" || p.tipo === "varias-opciones" || p.tipo === "si-no") {
      const cuenta: Record<string, number> = {};
      for (const v of valores) for (const x of Array.isArray(v) ? v : [String(v)]) cuenta[x] = (cuenta[x] ?? 0) + 1;
      return { id: p.id, texto: p.texto, tipo: p.tipo, cuenta, total: valores.length, textos: [] as string[] };
    }
    if (p.tipo === "escala") {
      const nums = valores.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      const cuenta: Record<string, number> = {};
      for (const n of nums) cuenta[String(n)] = (cuenta[String(n)] ?? 0) + 1;
      const promedio = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
      return { id: p.id, texto: p.texto, tipo: p.tipo, cuenta, promedio, total: nums.length, textos: [] as string[] };
    }
    return { id: p.id, texto: p.texto, tipo: p.tipo, cuenta: {}, total: valores.length, textos: valores.map(respuestaEnTexto) };
  });

  return NextResponse.json({
    ok: true,
    formulario: { id: f.id, slug: f.slug, titulo: f.titulo, preguntas: f.preguntas, activo: f.activo },
    respuestas,
    resumen,
    envios: {
      total: envios.filter((e) => e.estado !== "omitido").length,
      respondieron: envios.filter((e) => e.estado === "respondido").length,
    },
  });
}
