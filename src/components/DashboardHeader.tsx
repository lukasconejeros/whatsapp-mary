"use client";

interface DashboardHeaderProps {
  phone: string | null;
}

export default function DashboardHeader({ phone }: DashboardHeaderProps) {
  const handleDisconnect = async () => {
    if (!confirm("¿Desconectar WhatsApp? Tendrás que escanear el QR de nuevo.")) return;
    try {
      await fetch("/api/connection/disconnect", { method: "POST" });
      window.location.reload();
    } catch {
      alert("Error al desconectar. Inténtalo de nuevo.");
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-neutral-900 border-b border-neutral-800 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 text-sm text-neutral-300">
          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
          Agente conectado
        </span>
        {phone && (
          <span className="text-neutral-500 text-sm">+{phone}</span>
        )}
      </div>
      <button
        onClick={handleDisconnect}
        className="text-sm text-neutral-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-950 border border-transparent hover:border-red-900"
      >
        Desconectar
      </button>
    </header>
  );
}
