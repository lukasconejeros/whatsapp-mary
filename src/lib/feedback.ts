// Flujo de "feedback con fotos": Mary le pide al Asistente que le mande un mensaje
// (con fotos) a un apoderado. La IA redacta el texto y propone el destinatario;
// aquí resolvemos el contacto de forma DETERMINISTA (nada de que la IA invente
// teléfonos) y controlamos el envío.
import {
  searchClientes,
  getBorradorPendiente,
  cancelarBorradoresPendientes,
  crearBorradorFeedback,
  marcarFeedbackEnviado,
  getOrCreateConversation,
  enqueueOutbox,
  insertMessage,
  normalizarTexto,
  type Feedback,
} from "./db";
import { esNombreMediaSeguro } from "./media-path";

// ¿Deben heredarse las fotos del borrador previo a este turno? Sólo si el turno no
// trae fotos nuevas y se refiere al MISMO apoderado (o el previo aún no tenía
// destinatario = fotos adjuntas esperando nombre). Evita mandar fotos de un niño al
// apoderado de otro.
function debeHeredarFotos(prev: Feedback | null, destinatarioNuevo: string): boolean {
  if (!prev || prev.fotos.length === 0) return false;
  const prevDest = normalizarTexto(prev.destinatario ?? "");
  const nuevo = normalizarTexto(destinatarioNuevo);
  if (!prevDest || !nuevo) return true; // continuación (aclaración sin nombre nuevo)
  return prevDest.includes(nuevo) || nuevo.includes(prevDest);
}

// Paso 1: preparar el envío. Resuelve el destinatario y deja un borrador listo
// para confirmar. Devuelve el texto que se le muestra a Mary.
export function prepararEnvio(input: {
  destinatario?: string;
  mensaje?: string;
  fotos?: string[];
}): { respuesta: string } {
  const destinatario = (input.destinatario ?? "").trim();
  const mensaje = (input.mensaje ?? "").trim();

  // Fotos entrantes: sólo nombres de archivo seguros (anti path traversal).
  const fotosEntrantes = (input.fotos ?? []).filter(esNombreMediaSeguro);
  // Herencia: sólo si el turno no trae fotos nuevas Y se refiere al mismo apoderado.
  const prev = getBorradorPendiente();
  const fotos = fotosEntrantes.length
    ? fotosEntrantes
    : debeHeredarFotos(prev, destinatario) ? prev!.fotos : [];
  cancelarBorradoresPendientes();

  const fotosTxt = fotos.length ? `${fotos.length} foto${fotos.length > 1 ? "s" : ""}` : "";

  if (!mensaje) {
    crearBorradorFeedback({ destinatario, mensaje: "", fotos, estado: "sin_destinatario" });
    return { respuesta: "¿Qué mensaje quieres que le escriba al apoderado?" };
  }

  if (!destinatario) {
    crearBorradorFeedback({ destinatario, mensaje, fotos, estado: "sin_destinatario" });
    return {
      respuesta: `Tengo el mensaje listo${fotosTxt ? ` y ${fotosTxt}` : ""}. ¿A quién se lo mando? Dime el nombre del niño o del apoderado.`,
    };
  }

  const matches = searchClientes(destinatario);

  if (matches.length === 0) {
    crearBorradorFeedback({ destinatario, mensaje, fotos, estado: "sin_destinatario" });
    return {
      respuesta: `No encontré a "${destinatario}" 🤔. ¿Tendrá otro nombre, o quizás todavía no lo tienes registrado? Prueba con el nombre completo del niño o del apoderado.`,
    };
  }

  if (matches.length > 1) {
    crearBorradorFeedback({ destinatario, mensaje, fotos, estado: "ambiguo" });
    const lista = matches
      .slice(0, 6)
      .map((c, i) => `${i + 1}) ${c.nombre ?? "(sin nombre)"}${c.alumnos ? ` — ${c.alumnos}` : ""}`)
      .join("\n");
    return {
      respuesta: `Encontré varios que coinciden con "${destinatario}":\n${lista}\n\n¿A cuál le mando? Dime el nombre completo.`,
    };
  }

  const c = matches[0];
  crearBorradorFeedback({
    destinatario,
    cliente_telefono: c.telefono,
    cliente_nombre: c.nombre,
    mensaje,
    fotos,
    estado: "borrador",
  });
  const nino = c.alumnos ? ` (${c.alumnos})` : "";
  const adj = fotosTxt ? `\n📎 ${fotosTxt} adjunta${fotos.length > 1 ? "s" : ""}.` : "";
  return {
    respuesta: `Le escribiría esto a ${c.nombre ?? "el apoderado"}${nino}:\n\n"${mensaje}"${adj}\n\n¿Lo envío? Responde "sí" para mandarlo 💌`,
  };
}

// Paso 2: enviar de verdad el borrador pendiente (encola fotos + texto al WhatsApp
// del apoderado y lo registra en su chat como enviado por Mary).
export function ejecutarEnvio(): { ok: boolean; respuesta: string } {
  const b = getBorradorPendiente();
  if (!b) {
    return {
      ok: false,
      respuesta: "No tengo ningún mensaje preparado. Cuéntame para quién es y qué le digo.",
    };
  }
  if (b.estado === "ambiguo") {
    return { ok: false, respuesta: "Todavía no me dijiste a cuál. Dime el nombre completo del apoderado o del niño." };
  }
  if (b.estado !== "borrador" || !b.cliente_telefono) {
    return {
      ok: false,
      respuesta: `Todavía no sé a quién enviarle${b.destinatario ? ` "${b.destinatario}"` : ""}. Dime el nombre del niño o del apoderado.`,
    };
  }

  const conv = getOrCreateConversation(b.cliente_telefono);
  // Fotos primero, luego el texto: así al apoderado le llegan las fotos y después el mensaje.
  for (const foto of b.fotos) {
    enqueueOutbox(conv.id, conv.phone, "", { kind: "image", media: foto });
    insertMessage(conv.id, "human", "📷 Foto", foto);
  }
  enqueueOutbox(conv.id, conv.phone, b.mensaje, { kind: "text" });
  insertMessage(conv.id, "human", b.mensaje);
  marcarFeedbackEnviado(b.id);

  const nombre = b.cliente_nombre ?? "el apoderado";
  const fotosTxt = b.fotos.length ? ` con ${b.fotos.length} foto${b.fotos.length > 1 ? "s" : ""}` : "";
  return { ok: true, respuesta: `¡Listo! Le mandé el mensaje${fotosTxt} a ${nombre} 💌` };
}
