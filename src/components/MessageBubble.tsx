"use client";

type MessageRole = "user" | "assistant" | "human";

interface MessageBubbleProps {
  role: MessageRole;
  content: string;
  created_at: number; // UNIX seconds
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ role, content, created_at }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[75%] bg-neutral-800 rounded-2xl rounded-tl-sm px-4 py-2">
          <p className="text-neutral-100 text-sm whitespace-pre-wrap">{content}</p>
          <p className="text-neutral-500 text-xs mt-1">{formatTime(created_at)}</p>
        </div>
      </div>
    );
  }

  if (role === "assistant") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-emerald-900 border border-emerald-800 rounded-2xl rounded-tr-sm px-4 py-2">
          <p className="text-emerald-300 text-xs font-medium uppercase tracking-wider mb-1">
            Agente IA
          </p>
          <p className="text-neutral-100 text-sm whitespace-pre-wrap">{content}</p>
          <p className="text-emerald-700 text-xs mt-1">{formatTime(created_at)}</p>
        </div>
      </div>
    );
  }

  // role === 'human' (operator message)
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] bg-amber-900 border border-amber-800 rounded-2xl rounded-tr-sm px-4 py-2">
        <p className="text-amber-300 text-xs font-medium uppercase tracking-wider mb-1">
          Humano
        </p>
        <p className="text-neutral-100 text-sm whitespace-pre-wrap">{content}</p>
        <p className="text-amber-700 text-xs mt-1">{formatTime(created_at)}</p>
      </div>
    </div>
  );
}
