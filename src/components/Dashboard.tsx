"use client";

import { useState, useEffect } from "react";
import DashboardHeader from "./DashboardHeader";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";

type ConversationMode = "AI" | "HUMAN";

interface ConversationItem {
  id: number;
  phone: string;
  name: string | null;
  mode: ConversationMode;
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface DashboardProps {
  phone: string | null;
}

export default function Dashboard({ phone }: DashboardProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: ConversationItem[] };
      setConversations(data.conversations);
      // Auto-select first if nothing is selected
      if (selectedId === null && data.conversations.length > 0) {
        setSelectedId(data.conversations[0].id);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 2000);
    return () => clearInterval(interval);
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader phone={phone} />
      <div className="flex-1 grid grid-cols-[320px_1fr] overflow-hidden">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            // Reset selectedId if conversation was deleted
            if (!conversations.find((c) => c.id === id)) {
              setSelectedId(conversations[0]?.id ?? null);
            }
          }}
        />
        <ConversationPanel
          selected={selected}
          onRefresh={fetchConversations}
        />
      </div>
    </div>
  );
}
