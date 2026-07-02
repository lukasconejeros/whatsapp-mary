"use client";
import { useEffect, useState } from "react";
import type { Lead, LeadEstado } from "@/lib/types";
import { LEAD_STATE_CONFIG, LEAD_COLUMN_ORDER } from "@/lib/types";
import { X, Bot, User, PhoneCall } from "lucide-react";

interface LeadMsg { id: number; conversation_id: number; role: string; content: string; created_at: number }

export default function LeadSidebar({ lead, onClose, onUpdate }: {
  lead: Lead; onClose: () => void
  onUpdate: (id: number, changes: { estado?: LeadEstado; mode?: string }) => void
}) {
  const [messages, setMessages] = useState<LeadMsg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leads/${lead.id}`).then(r => r.json()).then(d => setMessages(d.messages ?? [])).finally(() => setLoading(false));
  }, [lead.id]);

  const cfg = LEAD_STATE_CONFIG[lead.estado];
  const botActive = lead.mode !== "HUMAN";

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="font-semibold text-sm text-slate-800">{lead.nombre ?? lead.phone}</p>
          <p className="text-xs text-slate-500">{lead.negocio ?? lead.phone}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-2 items-center">
        <select value={lead.estado} onChange={e => onUpdate(lead.id, { estado: e.target.value as LeadEstado })}
          className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700"
          style={{ borderLeftColor: cfg.accent, borderLeftWidth: 3 }}>
          {LEAD_COLUMN_ORDER.map(e => <option key={e} value={e}>{LEAD_STATE_CONFIG[e].label}</option>)}
        </select>
        <button onClick={() => onUpdate(lead.id, { mode: botActive ? "HUMAN" : "AI" })}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors"
          style={botActive ? { background: "#F0FDF4", color: "#15803D", borderColor: "#86EFAC" } : { background: "#F5F3FF", color: "#6D28D9", borderColor: "#C4B5FD" }}>
          <Bot size={12} />{botActive ? "Bot activo" : "Bot pausado"}
        </button>
        {lead.dolor && <span className="text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full truncate max-w-[160px]">💬 {lead.dolor}</span>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading && <p className="text-center text-xs text-slate-400 mt-8">Cargando chat...</p>}
        {!loading && messages.length === 0 && <p className="text-center text-xs text-slate-400 mt-8">Sin mensajes aún</p>}
        {messages.map(msg => {
          const isUser = msg.role === "user"; const isHuman = msg.role === "human";
          return (
            <div key={msg.id} className={`flex gap-2 ${isUser ? "justify-start" : "justify-end"}`}>
              {isUser && <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5"><User size={10} className="text-slate-500" /></div>}
              <div className="max-w-[75%] rounded-lg px-3 py-1.5 text-xs"
                style={isUser ? { background: "#F1F5F9", color: "#1E293B" } : isHuman ? { background: "#FEF9C3", color: "#713F12" } : { background: "#F3E7EC", color: "#1E40AF" }}>
                {msg.content}
              </div>
              {!isUser && <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={isHuman ? { background: "#FEF3C7" } : { background: "#F3E7EC" }}>
                {isHuman ? <PhoneCall size={10} className="text-yellow-700" /> : <Bot size={10} className="text-blue-600" />}
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
