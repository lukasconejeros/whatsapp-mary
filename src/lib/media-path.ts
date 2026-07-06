import path from "path";

const MEDIA_DIR = path.resolve(process.cwd(), "data/media");

// Un nombre de media es SEGURO sólo si es un basename dentro de data/media, sin
// separadores ni "..". Bloquea path traversal (ej: "../../.env", "/etc/passwd"),
// que permitiría exfiltrar archivos del servidor enviándolos a un cliente.
export function esNombreMediaSeguro(name: unknown): name is string {
  if (typeof name !== "string" || name.length === 0 || name.length > 200) return false;
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) return false;
  if (path.basename(name) !== name) return false;
  const resuelto = path.resolve(MEDIA_DIR, name);
  return resuelto === path.join(MEDIA_DIR, name) && resuelto.startsWith(MEDIA_DIR + path.sep);
}
