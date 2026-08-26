import { NextRequest, NextResponse } from "next/server";
import { listInscripciones, updateInscripcion, deleteInscripcion } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Cambiarle el día, la hora o la profesora a UN alumno, sin tocar a los demás de la
// sala: es justo lo que el modelo viejo no dejaba hacer.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const actual = listInscripciones().find((i) => i.id === id);
  if (!actual) return NextResponse.json({ ok: false, error: "esa inscripción no existe" }, { status: 404 });

  const b = await req.json() as {
    dia?: string | null; hora?: string; horaFin?: string | null; profe?: string | null; activa?: boolean;
  };
  const dia = b.dia === undefined ? actual.dia : b.dia;
  const hora = b.hora === undefined ? actual.hora : b.hora;
  const horaFin = b.horaFin === undefined ? actual.horaFin : b.horaFin;
  if (dia != null && !DIAS.includes(dia)) {
    return NextResponse.json({ ok: false, error: `dia debe ser uno de ${DIAS.join(", ")}` }, { status: 400 });
  }
  if (!HORA.test(hora)) return NextResponse.json({ ok: false, error: "hora debe ser HH:MM" }, { status: 400 });
  if (horaFin && !HORA.test(horaFin)) return NextResponse.json({ ok: false, error: "horaFin debe ser HH:MM" }, { status: 400 });
  if (horaFin && horaFin <= hora) {
    return NextResponse.json({ ok: false, error: "la hora de salida va después de la de entrada" }, { status: 400 });
  }

  updateInscripcion(id, {
    alumnoId: actual.alumnoId, dia, hora, horaFin,
    profe: b.profe === undefined ? actual.profe : b.profe,
    activa: b.activa === undefined ? actual.activa : b.activa,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteInscripcion(id);
  return NextResponse.json({ ok: true });
}
