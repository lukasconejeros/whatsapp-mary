import { NextRequest, NextResponse } from "next/server";

// Rate-limit en memoria (ventana deslizante) por IP+clave. Defensa básica contra
// abuso de los endpoints que gastan IA/CPU (no reemplaza a un WAF, pero corta el
// abuso trivial). El proceso web es de larga vida, así que el Map persiste.
const hits = new Map<string, number[]>();

function ip(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desconocido"
  );
}

// Devuelve una respuesta 429 si se superó el límite, o null si puede continuar.
export function limitar(req: NextRequest, clave: string, maxPorMinuto = 20): NextResponse | null {
  const ahora = Date.now();
  const ventana = 60_000;
  const k = `${clave}:${ip(req)}`;
  const prev = (hits.get(k) ?? []).filter((t) => ahora - t < ventana);
  if (prev.length >= maxPorMinuto) {
    return NextResponse.json({ ok: false, error: "Demasiadas solicitudes, espera un momento." }, { status: 429 });
  }
  prev.push(ahora);
  hits.set(k, prev);
  // Limpieza ocasional para no crecer sin límite.
  if (hits.size > 5000) {
    for (const [key, arr] of hits) if (arr.every((t) => ahora - t >= ventana)) hits.delete(key);
  }
  return null;
}
