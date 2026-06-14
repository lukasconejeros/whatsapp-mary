"use client";

type ConversationMode = "AI" | "HUMAN";

interface ConversationItem {
  id: number;
  phone: string;
  name: string | null;
  mode: ConversationMode;
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function formatRelative(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  return (
    <aside className="flex flex-col border-r border-neutral-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex-shrink-0">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Conversaciones · {conversations.length}
        </h2>
      </div>
      <div className="overflow-y-auto flex-1">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-neutral-500 text-sm">Sin conversaciones aún.</p>
            <p className="text-neutral-600 text-xs mt-1">
              Escribe "hola" al número desde otro móvil.
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-4 py-3 border-b border-neutral-800/50 transition-colors ${
                selectedId === conv.id
                  ? "bg-neutral-800"
                  : "hover:bg-neutral-900"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-neutral-200 truncate">
                  {conv.name ?? `+${conv.phone}`}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded uppercase tracking-wider font-medium flex-shrink-0 ${
                    conv.mode === "AI"
                      ? "bg-emerald-950 text-emerald-400"
                      : "bg-amber-950 text-amber-400"
                  }`}
                >
                  {conv.mode}
                </span>
              </div>
              {conv.name && (
                <p className="text-xs text-neutral-500 mb-0.5">+{conv.phone}</p>
              )}
              <div className="flex items-end justify-between gap-2">
                {conv.last_message_preview && (
                  <p className="text-xs text-neutral-500 truncate flex-1">
                    {conv.last_message_preview}
                  </p>
                )}
                <span className="text-xs text-neutral-600 flex-shrink-0">
                  {formatRelative(conv.last_message_at)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
