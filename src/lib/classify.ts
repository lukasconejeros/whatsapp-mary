import { getClienteByPhone, type Categoria } from "./db.js";

export interface CtwaReferral {
  source: string;            // p.ej. "ctwa_ad"
  title?: string;
  body?: string;
  sourceId?: string;         // id del anuncio
  sourceUrl?: string;
}

// Tipos laxos: el proto de Baileys trae estos campos de forma opcional.
interface ContextInfoLike {
  entryPointConversionSource?: string | null;
  externalAdReply?: {
    title?: string | null;
    body?: string | null;
    sourceId?: string | null;
    sourceUrl?: string | null;
  } | null;
}
type MessageLike = Record<string, unknown> | null | undefined;

// Subtipos de mensaje que pueden traer contextInfo con la referencia al anuncio.
const CTX_KEYS = [
  "extendedTextMessage",
  "imageMessage",
  "videoMessage",
  "documentMessage",
  "audioMessage",
] as const;

function getContextInfo(message: MessageLike): ContextInfoLike | null {
  if (!message || typeof message !== "object") return null;
  for (const k of CTX_KEYS) {
    const sub = (message as Record<string, { contextInfo?: ContextInfoLike } | undefined>)[k];
    if (sub && typeof sub === "object" && sub.contextInfo) return sub.contextInfo;
  }
  return null;
}

// Extrae la señal de "vino de un anuncio de Meta" (click-to-WhatsApp).
// Devuelve null si el mensaje no trae esa señal.
export function extractCtwaReferral(message: MessageLike): CtwaReferral | null {
  const ctx = getContextInfo(message);
  if (!ctx) return null;
  const isCtwa =
    (typeof ctx.entryPointConversionSource === "string" &&
      ctx.entryPointConversionSource.toLowerCase().includes("ctwa")) ||
    !!ctx.externalAdReply;
  if (!isCtwa) return null;
  const ad = ctx.externalAdReply ?? {};
  return {
    source: ctx.entryPointConversionSource ?? "ctwa_ad",
    title: ad.title ?? undefined,
    body: ad.body ?? undefined,
    sourceId: ad.sourceId ?? undefined,
    sourceUrl: ad.sourceUrl ?? undefined,
  };
}

// Reglas deterministas en orden:
//   1) vino de anuncio (CTWA) → potencial
//   2) número está en la lista de clientes → arteluk
//   3) default → mary
export function classifyCategoria(input: {
  phone: string;
  ctwaReferral: CtwaReferral | null;
}): Categoria {
  if (input.ctwaReferral) return "potencial";
  if (getClienteByPhone(input.phone)) return "arteluk";
  return "mary";
}
