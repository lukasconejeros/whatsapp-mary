"use client";

import { useState, useEffect } from "react";

type Status = "disconnected" | "qr" | "connecting" | "connected" | "unknown";

interface QRScreenProps {
  status: Status;
  qrPng: string | null;
}

function statusMessage(status: Status): string {
  switch (status) {
    case "qr":
      return "Escanea el QR con WhatsApp";
    case "connecting":
      return "Conectando...";
    case "disconnected":
      return "Esperando al bot...";
    default:
      return "Cargando...";
  }
}

export default function QRScreen({ status, qrPng }: QRScreenProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "qr") {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <div className="w-full max-w-md bg-neutral-900 rounded-2xl p-8 border border-neutral-800 shadow-2xl">
        <h1 className="text-2xl font-bold text-neutral-100 mb-2 text-center">
          Conectar WhatsApp
        </h1>
        <p className="text-neutral-400 text-sm text-center mb-6">
          {statusMessage(status)}
        </p>

        {qrPng ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-xl">
              <img src={qrPng} alt="QR WhatsApp" width={256} height={256} />
            </div>
            {elapsed > 60 && (
              <p className="text-amber-400 text-sm text-center bg-amber-950 border border-amber-800 rounded-lg px-3 py-2">
                El QR puede haber caducado. Recarga la página para generar uno nuevo.
              </p>
            )}
            <ol className="text-neutral-400 text-sm space-y-1 list-decimal list-inside">
              <li>Abre WhatsApp en tu móvil</li>
              <li>Ve a Dispositivos vinculados</li>
              <li>Toca "Vincular un dispositivo"</li>
              <li>Escanea este código QR</li>
            </ol>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-10 h-10 border-2 border-neutral-600 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-neutral-500 text-sm">{statusMessage(status)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
