import { NextRequest, NextResponse } from "next/server";
import { getAlumno, addInscripcion } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Ponerle un día de clase a un alumno. 'dia' puede ir en null a propósito: son las
// tres alumnas de la foto que llegó sin encabezado, que existen pero todavía no se
// sabe qué día vienen.
export async function POST(req: NextRequest, ctx: Ctx) {
  const alumnoId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(alumnoId)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  if (!getAlumno(alumnoId)) return NextResponse.json({ ok: false, error: "ese alumno no existe" }, { status: 404 });

  const b = await req.json() as { dia?: string | null; hora?: string; horaFin?: string | null; profe?: string | null };
  if (b.dia != null && !DIAS.includes(b.dia)) {
    return NextResponse.json({ ok: false, error: `dia debe ser uno de ${DIAS.join(", ")}` }, { status: 400 });
  }
  if (!b.hora || !HORA.test(b.hora)) {
    return NextResponse.json({ ok: false, error: "hora debe ser HH:MM" }, { status: 400 });
  }
  if (b.horaFin && !HORA.test(b.horaFin)) {
    return NextResponse.json({ ok: false, error: "horaFin debe ser HH:MM" }, { status: 400 });
  }
  if (b.horaFin && b.horaFin <= b.hora) {
    return NextResponse.json({ ok: false, error: "la hora de salida va después de la de entrada" }, { status: 400 });
  }
  const id = addInscripcion({ alumnoId, dia: b.dia ?? null, hora: b.hora, horaFin: b.horaFin ?? null, profe: b.profe ?? null });
  return NextResponse.json({ ok: true, id });
}
