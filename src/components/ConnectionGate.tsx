"use client";

import { useState, useEffect } from "react";
import QRScreen from "./QRScreen";
import Dashboard from "./Dashboard";

type Status = "disconnected" | "qr" | "connecting" | "connected" | "unknown";

interface StatusResponse {
  status: Status;
  qrPng?: string;
  phone?: string;
}

export default function ConnectionGate() {
  const [status, setStatus] = useState<Status>("unknown");
  const [qrPng, setQrPng] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/connection/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (!mounted) return;
        setStatus(data.status);
        setQrPng(data.qrPng ?? null);
        setPhone(data.phone ?? null);
      } catch {
        // network error — keep current state
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (status === "connected") {
    return <Dashboard phone={phone} />;
  }

  return <QRScreen status={status} qrPng={qrPng} />;
}
