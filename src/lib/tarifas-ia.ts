/**
 * Tarifas US$ por millón de tokens, para contabilizar el gasto de IA (13-08-2026, mismas
 * tarifas que usan Medifis y Conejeros). Aparte de `ai.ts` a propósito: este archivo lo
 * importan tanto el bot (vía tsx, imports con `.js`) como `ensayo.ts` (vía Next, imports
 * sin extensión) — meter `ai.ts` en el bundle de Next rompía el build porque sus imports
 * `.js` no resuelven bajo el webpack de Next.
 */
export function tarifaPorModelo(model: string): { in: number; out: number } {
  if (/haiku/i.test(model)) return { in: 1.0, out: 5.0 };
  if (/opus/i.test(model)) return { in: 5.0, out: 25.0 };
  // Sonnet o cualquier modelo desconocido: mejor que se vea caro de más a que se
  // esconda gasto real (la misma regla que usa Medifis en tarifasDe).
  return { in: 3.0, out: 15.0 };
}

export function estimarUSD(model: string, promptTokens: number, completionTokens: number): number {
  const t = tarifaPorModelo(model);
  return (promptTokens * t.in + completionTokens * t.out) / 1_000_000;
}
