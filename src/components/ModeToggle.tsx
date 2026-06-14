"use client";

type ConversationMode = "AI" | "HUMAN";

interface ModeToggleProps {
  mode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
}

export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-neutral-700 text-sm">
      <button
        onClick={() => onModeChange("AI")}
        className={`px-3 py-1.5 font-medium transition-colors ${
          mode === "AI"
            ? "bg-emerald-600 text-white"
            : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
        }`}
      >
        Modo IA
      </button>
      <button
        onClick={() => onModeChange("HUMAN")}
        className={`px-3 py-1.5 font-medium transition-colors ${
          mode === "HUMAN"
            ? "bg-amber-600 text-white"
            : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
        }`}
      >
        Modo Humano
      </button>
    </div>
  );
}
