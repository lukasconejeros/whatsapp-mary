import { NextRequest, NextResponse } from "next/server";
import { getMessages, setMode } from "@/lib/db";
import Database from "better-sqlite3";
import path from "path";

export const dynamic = "force-dynamic";

function db() {
  const p = path.resolve(process.cwd(), "data/messages.db");
  const d = new Database(p); d.pragma("journal_mode = WAL"); return d;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const d = db();
  const lead = d.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as { conversation_id: number | null } | undefined;
  if (!lead?.conversation_id) { d.close(); return NextResponse.json({ messages: [] }); }
  const messages = getMessages(lead.conversation_id, 100);
  d.close();
  return NextResponse.json({ messages });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = parseInt(id, 10);
  const changes = await req.json() as { estado?: string; mode?: string };
  const d = db();

  if (changes.estado) d.prepare("UPDATE leads SET estado = ? WHERE id = ?").run(changes.estado, leadId);
  if (changes.mode) {
    const lead = d.prepare("SELECT conversation_id FROM leads WHERE id = ?").get(leadId) as { conversation_id: number | null } | undefined;
    if (lead?.conversation_id) setMode(lead.conversation_id, changes.mode as "AI" | "HUMAN");
  }
  d.close();
  return NextResponse.json({ ok: true });
}
