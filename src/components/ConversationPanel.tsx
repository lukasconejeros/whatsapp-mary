"use client";

import { useState, useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";

type ConversationMode = "AI" | "HUMAN";

interface ConversationItem {
  id: number;
  phone: string;
  name: string | null;
  mode: ConversationMode;
}

interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface ConversationPanelProps {
  selected: ConversationItem | null;
  onRefresh: () => void;
}

export default function ConversationPanel({
  selected,
  onRefresh,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    let mounted = true;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${selected.id}`, {
          cache: "no-store",
        });
        if (!res.ok || !mounted) return;
        const data = (await res.json()) as { messages: Message[] };
        setMessages(data.messages);
      } catch {
        // ignore network errors
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selected?.id]);

  // Autoscroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleModeChange = async (mode: ConversationMode) => {
    if (!selected) return;
    await fetch(`/api/mode/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    onRefresh();
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`¿Borrar conversación con ${selected.name ?? "+" + selected.phone}?`)) return;
    await fetch(`/api/conversations/${selected.id}`, { method: "DELETE" });
    onRefresh();
  };

  const handleSend = async () => {
    if (!selected || !input.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`/api/messages/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      setInput("");
      onRefresh();
    } finally {
      setSending(false);
    }
  };

  if (!selected) {
    return (
      <section className="flex items-center justify-center text-neutral-600 text-sm">
        Selecciona una conversación
      </section>
    );
  }

  return (
    <section className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 flex-shrink-0">
        <div>
          <p className="font-medium text-neutral-200">
            {selected.name ?? `+${selected.phone}`}
          </p>
          {selected.name && (
            <p className="text-xs text-neutral-500">+{selected.phone}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle mode={selected.mode} onModeChange={handleModeChange} />
          <button
            onClick={handleDelete}
            className="text-sm text-neutral-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-950"
            title="Borrar conversación"
          >
            Borrar
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            created_at={msg.created_at}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-800 p-4 flex-shrink-0">
        {selected.mode === "HUMAN" ? (
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe un mensaje... (Enter para enviar)"
              rows={2}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 resize-none focus:outline-none focus:border-amber-600"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors self-end"
            >
              {sending ? "..." : "Enviar"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 text-center">
            El agente IA responde automáticamente.{" "}
            <button
              onClick={() => handleModeChange("HUMAN")}
              className="text-amber-400 hover:underline"
            >
              Cambia a Modo Humano
            </button>{" "}
            para escribir tú.
          </p>
        )}
      </div>
    </section>
  );
}
