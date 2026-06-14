import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const NEGOCIO_PATH = path.resolve(process.cwd(), "prompts", "negocio.md");

type Bloque =
  | { tipo: "raw"; texto: string }
  | { tipo: "seccion"; titulo: string; contenido: string; tecnica: boolean };

// Secciones que afectan el comportamiento técnico del bot (editar con cuidado)
const TECNICAS = ["filtro", "instruccion", "cómo atender", "como atender", "flujo"];
function esTecnica(titulo: string): boolean {
  const t = titulo.toLowerCase();
  return TECNICAS.some((k) => t.includes(k));
}

function parse(md: string): { frontmatter: string; bloques: Bloque[] } {
  let frontmatter = "";
  let body = md;

  if (md.startsWith("---")) {
    const end = md.indexOf("\n---", 3);
    if (end !== -1) {
      frontmatter = md.slice(0, end + 4);
      body = md.slice(end + 4);
    }
  }

  const lines = body.split("\n");
  const bloques: Bloque[] = [];
  let rawBuf: string[] = [];
  let cur: { titulo: string; contenido: string[] } | null = null;

  const flushRaw = () => {
    const txt = rawBuf.join("\n").trim();
    if (txt) bloques.push({ tipo: "raw", texto: txt });
    rawBuf = [];
  };
  const flushSec = () => {
    if (cur) {
      bloques.push({
        tipo: "seccion",
        titulo: cur.titulo,
        contenido: cur.contenido.join("\n").trim(),
        tecnica: esTecnica(cur.titulo),
      });
      cur = null;
    }
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (cur) flushSec();
      else flushRaw();
      cur = { titulo: h2[1].trim(), contenido: [] };
    } else if (cur) {
      cur.contenido.push(line);
    } else {
      rawBuf.push(line);
    }
  }
  flushSec();
  flushRaw();

  return { frontmatter, bloques };
}

function rebuild(frontmatter: string, bloques: Bloque[]): string {
  const parts = bloques.map((b) =>
    b.tipo === "raw" ? b.texto : `## ${b.titulo}\n${b.contenido}`
  );
  return `${frontmatter.trim()}\n\n${parts.join("\n\n")}\n`;
}

export async function GET() {
  try {
    if (!fs.existsSync(NEGOCIO_PATH)) {
      return NextResponse.json({ ok: true, frontmatter: "", bloques: [] });
    }
    const md = fs.readFileSync(NEGOCIO_PATH, "utf-8");
    const { frontmatter, bloques } = parse(md);
    return NextResponse.json({ ok: true, frontmatter, bloques });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { frontmatter, bloques } = (await req.json()) as {
      frontmatter: string;
      bloques: Bloque[];
    };
    if (!Array.isArray(bloques)) {
      return NextResponse.json({ ok: false, error: "Formato inválido" }, { status: 400 });
    }
    const md = rebuild(frontmatter ?? "", bloques);
    // Backup antes de sobrescribir
    if (fs.existsSync(NEGOCIO_PATH)) {
      fs.copyFileSync(NEGOCIO_PATH, NEGOCIO_PATH + ".bak");
    }
    fs.writeFileSync(NEGOCIO_PATH, md, "utf-8");
    // El bot recarga solo: system-prompt.ts cachea por mtime del archivo.
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
