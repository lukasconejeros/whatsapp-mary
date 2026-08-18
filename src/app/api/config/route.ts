import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  ETIQUETAS,
  bloquesDelPrompt,
  getOverrides,
  setOverrides,
  sanear,
  type ClaveSeccion,
} from "@/lib/secciones-negocio";
import { getBienvenida, setBienvenida, validarBienvenida, DEFAULT_BIENVENIDA } from "@/lib/mensajes";

export const dynamic = "force-dynamic";

const NEGOCIO_PATH = path.resolve(process.cwd(), "prompts", "negocio.md");

// ANTES esta ruta ESCRIBÍA prompts/negocio.md, que viaja dentro de la imagen del contenedor:
// cada deploy restauraba el archivo y borraba en silencio lo que Mary hubiera cambiado. Ahora
// lo que ella edita se guarda en la base (tabla `config`) y pisa su sección al armar el prompt,
// así que sobrevive a los deploys — y los arreglos del prompt hechos en el repo siguen llegando.
// El detalle está en src/lib/secciones-negocio.ts.

function leerPrompt(): string {
  if (!fs.existsSync(NEGOCIO_PATH)) return "";
  let md = fs.readFileSync(NEGOCIO_PATH, "utf-8");
  if (md.startsWith("---")) {
    const end = md.indexOf("\n---", 3);
    if (end !== -1) md = md.slice(end + 4);
  }
  return md;
}

export async function GET() {
  try {
    const bloques = bloquesDelPrompt(leerPrompt(), getOverrides()).map((b) => ({
      ...b,
      // El nombre en cristiano para el panel; las reglas del repo se muestran con su título tal cual.
      etiqueta: b.clave ? ETIQUETAS[b.clave] : b.titulo,
    }));
    // El saludo viaja junto a los bloques para que la pantalla se cargue y se guarde de una sola vez:
    // dos botones de guardar hacían que la secretaria de otra clínica perdiera lo que no apretó.
    return NextResponse.json({ ok: true, bloques, saludo: getBienvenida(), saludoDeFabrica: DEFAULT_BIENVENIDA });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      secciones?: Partial<Record<ClaveSeccion, string>>;
      saludo?: string;
    };
    // El saludo se guarda aunque no vengan secciones (y al revés): son dos cosas independientes.
    if (typeof body?.saludo === "string") {
      const v = validarBienvenida(body.saludo);
      if (!v.ok) return NextResponse.json({ ok: false, error: v.motivo }, { status: 400 });
      setBienvenida(body.saludo);
    }
    if (!body?.secciones || typeof body.secciones !== "object") {
      // Solo el saludo también es una petición válida.
      if (typeof body?.saludo === "string") return NextResponse.json({ ok: true, guardadas: ["saludo"] });
      return NextResponse.json({ ok: false, error: "Formato inválido" }, { status: 400 });
    }
    // `sanear` deja fuera cualquier clave que no sea de Mary y neutraliza los encabezados: por el
    // formulario no puede entrar una regla nueva al cerebro del bot.
    const limpio = sanear(body.secciones);
    setOverrides(limpio);
    return NextResponse.json({ ok: true, guardadas: Object.keys(limpio) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
