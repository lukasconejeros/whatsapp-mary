import { NextResponse } from "next/server";
import { listClientes } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, clientes: listClientes() });
}
