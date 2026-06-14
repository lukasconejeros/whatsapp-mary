import { NextResponse } from "next/server";
import { listConversations } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const raw = listConversations();

  const conversations = raw.map(c => ({
    id:      c.id,
    // mode HUMAN siempre manda (derivado). Si no, usar el estado del embudo.
    state:   c.mode === 'HUMAN' ? 'derivado' : (c.estado ?? 'activo'),
    status:  'open',
    labels:  c.mode === 'HUMAN' ? ['apagar_bot'] : [],
    channel: 'whatsapp',
    contact: { name: c.name ?? c.phone, phone: c.phone, avatar: '' },
    assignee: null,
    lastMessage: {
      content:   c.last_message_preview ?? '',
      createdAt: c.last_message_at ?? c.created_at ?? 0,
      fromHuman: false,
    },
    createdAt: c.created_at ?? 0,
    updatedAt: c.last_message_at ?? c.created_at ?? 0,
    inboxId:   1,
    botActive: c.mode === 'AI',
    categoria: (c.categoria ?? 'mary'),
    ctwaReferral: c.ctwa_referral ? safeJson(c.ctwa_referral) : null,
  }));

  return NextResponse.json({ ok: true, conversations });
}

function safeJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
}
