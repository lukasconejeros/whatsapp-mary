"use client";
import { useEffect, useState, useCallback } from "react";
import AppNav from "@/components/AppNav";
import LeadCard from "@/components/LeadCard";
import LeadSidebar from "@/components/LeadSidebar";
import type { Lead, LeadEstado } from "@/lib/types";
import { LEAD_COLUMN_ORDER, LEAD_STATE_CONFIG } from "@/lib/types";
import { RefreshCw } from "lucide-react";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const d = await fetch("/api/leads").then(r => r.json()) as { leads: Lead[] };
      setLeads(d.leads ?? []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchLeads(); const t = setInterval(() => fetchLeads(true), 30_000); return () => clearInterval(t); }, [fetchLeads]);

  const handleUpdate = async (id: number, changes: { estado?: LeadEstado; mode?: string }) => {
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...(changes.estado ? { estado: changes.estado } : {}), ...(changes.mode ? { mode: changes.mode as "AI" | "HUMAN" } : {}) } : l));
  };

  const selectedLead = leads.find(l => l.id === selectedId) ?? null;
  const grouped = LEAD_COLUMN_ORDER.reduce<Record<LeadEstado, Lead[]>>((acc, e) => { acc[e] = leads.filter(l => l.estado === e); return acc; }, {} as Record<LeadEstado, Lead[]>);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FFFFFF' }}>
      <AppNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-white" style={{ borderColor: '#FAD1E5' }}>
          <div>
            <h1 className="text-base font-bold" style={{ color: '#9D174D' }}>Panel de Leads</h1>
            <p className="text-xs" style={{ color: '#F7CFE1' }}>{leads.length} leads totales</p>
          </div>
          <button onClick={() => fetchLeads(true)} disabled={refreshing} className="flex items-center gap-1.5 text-xs transition-colors" style={{ color: '#EC4899' }}>
            <RefreshCw size={13} className={refreshing ? "spin" : ""} />Actualizar
          </button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#F7CFE1' }}>Cargando leads...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 h-full px-4 py-4" style={{ minWidth: "900px" }}>
              {LEAD_COLUMN_ORDER.map(estado => {
                const cfg = LEAD_STATE_CONFIG[estado]; const col = grouped[estado];
                return (
                  <div key={estado} className="flex flex-col w-52 shrink-0">
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg mb-1" style={{ background: cfg.bg }}>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ background: cfg.accent, color: "white" }}>{col.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                      {col.length === 0 ? <div className="text-center text-[11px] text-slate-300 mt-4">Sin leads</div>
                        : col.map(lead => <LeadCard key={lead.id} lead={lead} selected={selectedId === lead.id} onClick={() => setSelectedId(lead.id === selectedId ? null : lead.id)} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {selectedLead && (
        <div className="w-80 shrink-0 shadow-xl">
          <LeadSidebar lead={selectedLead} onClose={() => setSelectedId(null)} onUpdate={handleUpdate} />
        </div>
      )}
    </div>
  );
}
