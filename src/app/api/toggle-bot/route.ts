import { NextRequest, NextResponse } from "next/server";
import { setMode, getConversationById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { conversationId, currentLabels } = await req.json();
  const botWasOff = (currentLabels as string[] || []).includes('apagar_bot');
  const newMode   = botWasOff ? 'AI' : 'HUMAN';
  const nowActive = botWasOff;

  setMode(conversationId, newMode);

  return NextResponse.json({
    ok: true,
    botActive: nowActive,
    labels: nowActive ? [] : ['apagar_bot'],
  });
}
