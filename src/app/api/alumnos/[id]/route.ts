import { NextRequest, NextResponse } from "next/server";
import { getAlumno, updateAlumno, deleteAlumno } from "@/lib/db";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ id: string }> }

// Corregir la ficha. Es también la forma de resolver una duda de la planilla:
// mandando revisar: null se le quita la marca amarilla a esa tarjeta.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  const a = getAlumno(id);
  if (!a) return NextResponse.json({ ok: false, error: "ese alumno no existe" }, { status: 404 });

  const b = await req.json() as {
    nombre?: string; apoderado?: string | null; telefono?: string | null;
    mensualidad?: number; notas?: string | null; revisar?: string | null; activo?: boolean;
  };
  const nombre = b.nombre === undefined ? a.nombre : b.nombre.trim();
  if (!nombre) return NextResponse.json({ ok: false, error: "el nombre es obligatorio" }, { status: 400 });

  // Lo que no venga en el cuerpo se queda como estaba: la pantalla manda solo lo
  // que Mary tocó, y no debe borrar de rebote el teléfono o la mensualidad.
  updateAlumno(id, {
    nombre,
    apoderado: b.apoderado === undefined ? a.apoderado : b.apoderado,
    telefono: b.telefono === undefined ? a.telefono : b.telefono,
    mensualidad: b.mensualidad === undefined ? a.mensualidad : b.mensualidad,
    notas: b.notas === undefined ? a.notas : b.notas,
    revisar: b.revisar === undefined ? a.revisar : b.revisar,
    activo: b.activo === undefined ? a.activo : b.activo,
  });
  return NextResponse.json({ ok: true });
}

// Borra al alumno y sus días. Para "ya no viene" es mejor darlo de baja con
// PATCH { activo: false }: sale del CRM pero no se pierde su historial.
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  deleteAlumno(id);
  return NextResponse.json({ ok: true });
}
