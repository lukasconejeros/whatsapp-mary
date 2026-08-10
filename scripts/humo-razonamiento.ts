/**
 * Humo del razonamiento: UNA llamada real para comprobar que Haiku 4.5 no solo acepta la
 * petición, sino que de verdad piensa antes de contestar.
 *
 * Un test de forma (test:razonamiento) puede estar verde con la API rechazando la llamada
 * en producción: el 04-08 pasó igual con la voz, 33/33 en verde y el audio real petando.
 * Por eso este script mira la RESPUESTA: si no vuelve ningún bloque de razonamiento, el
 * razonamiento no está encendido, diga lo que diga el cuerpo de la petición.
 *
 *   npx tsx scripts/humo-razonamiento.ts
 */
import "./env-loader.js";
import { cuerpoEnsayo } from "../src/lib/ensayo.js";

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) { console.error("💥 Falta ANTHROPIC_API_KEY"); process.exit(2); }

const cuerpo = cuerpoEnsayo(
  "Eres el asistente de un taller de arte. Contestas corto y en español.",
  [{ role: "user", content: "Tengo dos hijas, una de 6 y otra de 14. ¿Pueden ir las dos al mismo grupo?" }]
);

const t0 = Date.now();
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  body: JSON.stringify(cuerpo),
});

if (!res.ok) {
  console.error(`💥 La API respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

const data = (await res.json()) as {
  content: { type: string; text?: string; thinking?: string }[];
  usage?: Record<string, number>;
};
const demora = Date.now() - t0;

const pensados = data.content.filter((c) => c.type === "thinking" || c.type === "redacted_thinking");
const texto = data.content.filter((c) => c.type === "text").map((c) => c.text).join(" ").trim();

console.log(`\n⏱  tardó ${(demora / 1000).toFixed(1)} s`);
console.log(`🧠 bloques de razonamiento: ${pensados.length}`);
if (pensados[0]?.thinking) console.log(`   (pensó: "${pensados[0].thinking.slice(0, 120).replace(/\n/g, " ")}…")`);
console.log(`💬 respuesta: ${texto}`);
console.log(`📊 tokens: ${JSON.stringify(data.usage ?? {})}\n`);

if (!pensados.length) {
  console.error("❌ No vino ningún bloque de razonamiento: NO está pensando.");
  process.exit(1);
}
console.log("✅ El razonamiento está encendido de verdad.\n");
