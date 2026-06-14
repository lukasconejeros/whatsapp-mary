"use client";
import type { Lead } from "@/lib/types";
import { LEAD_STATE_CONFIG } from "@/lib/types";

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function LeadCard({ lead, selected, onClick }: { lead: Lead; selected: boolean; onClick: () => void }) {
  const cfg = LEAD_STATE_CONFIG[lead.estado];
  return (
    <div onClick={onClick} className="cursor-pointer rounded-lg bg-white p-3 shadow-sm transition-all hover:shadow-md"
      style={{ borderLeft: `4px solid ${cfg.accent}`, outline: selected ? `2px solid ${cfg.accent}` : "none", outlineOffset: "2px" }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-slate-800 truncate">{lead.nombre ?? lead.phone}</p>
          <p className="text-xs text-slate-500 truncate">{lead.negocio ?? "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-slate-400">{timeAgo(lead.last_message_at ?? lead.created_at)}</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#DCFCE7", color: "#15803D" }}>WA</span>
        </div>
      </div>
      {lead.last_message && <p className="text-[11px] text-slate-400 truncate italic">"{lead.last_message}"</p>}
      {lead.mode === "HUMAN" && <span className="mt-1 inline-block text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">bot pausado</span>}
    </div>
  );
}
