// Normaliza teléfonos chilenos a formato canónico de WhatsApp: "569XXXXXXXX"
// (código país 56 + 9 + 8 dígitos), igual que el `phone` que entrega el JID.
// Devuelve null si no parece un teléfono válido.
export function normalizeChilePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D+/g, ""); // solo dígitos
  if (!d) return null;

  // Quitar prefijo internacional 00
  if (d.startsWith("00")) d = d.slice(2);

  // Ya viene con 56...
  if (d.startsWith("56")) {
    // 56 + 9 + 8 dígitos = 11 dígitos
    if (d.length === 11 && d[2] === "9") return d;
    // 56 + 8 dígitos de celular sin el 9 → insertar 9
    if (d.length === 10 && d[2] !== "9") return "569" + d.slice(2);
    if (d.length === 11) return d; // fijo u otro, se deja
    return null;
  }

  // 9 + 8 dígitos (celular local con 9)
  if (d.length === 9 && d[0] === "9") return "56" + d;
  // 8 dígitos (celular sin 9) → asumir celular
  if (d.length === 8) return "569" + d;

  return null;
}
