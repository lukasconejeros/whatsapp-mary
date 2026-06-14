import "./env-loader.js";
import { generateReply } from "../src/lib/ai.js";
import type { Message } from "../src/lib/db.js";

const CONV_ID = 9999; // ID ficticio para las pruebas

// Simula una conversación completa y muestra las respuestas del bot
async function testConversation(nombre: string, mensajes: string[]) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`ESCENARIO: ${nombre}`);
  console.log("=".repeat(60));

  const history: Message[] = [];
  let msgId = 1;

  for (const texto of mensajes) {
    // Agregar mensaje del usuario
    history.push({
      id: msgId++,
      conversation_id: CONV_ID,
      role: "user",
      content: texto,
      created_at: Date.now(),
    });

    console.log(`\n👤 Lead: ${texto}`);

    // Obtener respuesta del bot
    const reply = await generateReply({
      history,
      conversationId: CONV_ID,
      phone: "56912345678",
    });

    if (reply) {
      console.log(`🤖 Bot:  ${reply}`);
      history.push({
        id: msgId++,
        conversation_id: CONV_ID,
        role: "assistant",
        content: reply,
        created_at: Date.now(),
      });
    } else {
      console.log(`🤖 Bot:  [SILENCIO — no respondió]`);
    }

    // Pausa breve para no saturar la API
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main() {
  console.log("🧪 Test de conversaciones de ventas — Orion.AI\n");

  // ── Escenario 1: Lead ideal desde anuncio ──────────────────────
  await testConversation("Lead ideal — dueño de clínica dental", [
    "hola más info",
    "soy el dueño de una clínica dental en Santiago",
    "tenemos como 3 dentistas y las secretarias están siempre saturadas respondiendo WhatsApp",
    "¿cuánto cuesta?",
    "me interesa, pero necesito pensarlo",
    "ok dale agendemos una llamada",
    "Lucas Martínez",
    "lucas@clinicamartinez.cl",
    "el jueves a las 15:00",
  ]);

  // ── Escenario 2: Lead tibio con objeciones ─────────────────────
  await testConversation("Lead tibio — pide precio, duda", [
    "hola quiero información de orion",
    "soy administradora de una clínica estética",
    "¿y si no funciona?",
    "¿cuánto tiempo tarda el setup?",
    "ok me convenciste",
  ]);

  // ── Escenario 3: Contacto equivocado (debe silenciarse) ─────────
  await testConversation("Contacto equivocado — debe silenciarse", [
    "hola necesito un plomero para arreglar una cañería",
  ]);

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Tests completados");
  console.log("=".repeat(60));
}

main().catch(console.error);
