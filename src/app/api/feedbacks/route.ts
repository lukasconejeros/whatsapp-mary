import { NextResponse } from "next/server";
import { listFeedbacksEnviados } from "@/lib/db";

export const dynamic = "force-dynamic";

// Historial de feedbacks/felicitaciones que Mary ya envió a los apoderados.
export async function GET() {
  return NextResponse.json({ ok: true, feedbacks: listFeedbacksEnviados(100) });
}
