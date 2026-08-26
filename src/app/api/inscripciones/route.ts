import { NextResponse } from "next/server";
import { listInscripcionesConAlumno } from "@/lib/db";

export const dynamic = "force-dynamic";

// El horario completo: quién viene cada día, con SU hora de salida y su profesora.
// El calendario lo pide UNA vez y con eso dibuja el mes entero (las inscripciones
// valen para todas las semanas, así que no hace falta pedirlas día por día).
export async function GET() {
  return NextResponse.json({ ok: true, inscripciones: listInscripcionesConAlumno() });
}
