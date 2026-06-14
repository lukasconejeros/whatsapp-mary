import { google } from "googleapis";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { setEstado } from "../db.js";

export const agendarDefinition = {
  type: "function" as const,
  function: {
    name: "agendar",
    description:
      "Agenda una videollamada de demo con Google Meet cuando calificar() devuelve score >= 7. " +
      "ANTES de llamar esta tool debes tener: nombre, email, fecha (YYYY-MM-DD) y hora (HH:MM). " +
      "Si el lead no ha dado alguno de esos datos, pídeselo primero.",
    parameters: {
      type: "object" as const,
      properties: {
        nombre:   { type: "string", description: "Nombre completo del lead" },
        email:    { type: "string", description: "Email del lead para el invite de Google Meet" },
        telefono: { type: "string", description: "Teléfono del lead" },
        fecha:    { type: "string", description: "Fecha de la reunión en formato YYYY-MM-DD" },
        hora:     { type: "string", description: "Hora de la reunión en formato HH:MM (hora Chile)" },
        clinica:  { type: "string", description: "Nombre de la clínica o empresa del lead" },
      },
      required: ["nombre", "email", "fecha", "hora"],
    },
  },
};

export async function agendar(
  args: Record<string, unknown>,
  ctx?: { conversationId: number }
): Promise<Record<string, unknown>> {
  const nombre   = String(args.nombre   ?? "");
  const email    = String(args.email    ?? "");
  const telefono = String(args.telefono ?? "");
  const fecha    = String(args.fecha    ?? "");
  const hora     = String(args.hora     ?? "");
  const clinica  = String(args.clinica  ?? nombre);

  try {
    // ── 1. Auth con service account ──────────────────────────────
    const keyFile = path.resolve(
      process.cwd(),
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ?? "./secrets/google-service-account.json"
    );
    if (!fs.existsSync(keyFile)) {
      return { ok: false, message: "Falta el archivo de service account en " + keyFile };
    }

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    // ── 2. Crear evento en Google Calendar con Google Meet ────────
    const calendar = google.calendar({ version: "v3", auth });

    // Calcular hora de fin (+45 min)
    const startMs  = new Date(`${fecha}T${hora}:00`).getTime();
    const endDate  = new Date(startMs + 45 * 60 * 1000);
    const endHH    = String(endDate.getHours()).padStart(2, "0");
    const endMM    = String(endDate.getMinutes()).padStart(2, "0");
    const endHora  = `${endHH}:${endMM}`;

    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
    const notifyEmail = process.env.GOOGLE_NOTIFY_EMAIL ?? "lukas.conejero40@gmail.com";

    const eventRes = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: `Demo Orion.AI — ${clinica}`,
        description: `Demo de 30 minutos con ${nombre} de ${clinica}.\nTeléfono: ${telefono}`,
        start: { dateTime: `${fecha}T${hora}:00`, timeZone: "America/Santiago" },
        end:   { dateTime: `${fecha}T${endHora}:00`, timeZone: "America/Santiago" },
        attendees: [
          { email },
          { email: notifyEmail },
        ],
        conferenceData: {
          createRequest: {
            requestId: `orion-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const meetLink  = eventRes.data.conferenceData?.entryPoints?.[0]?.uri ?? "";
    const eventLink = eventRes.data.htmlLink ?? "";

    // ── 3. Email de confirmación via Gmail SMTP ───────────────────
    const gmailUser = process.env.GMAIL_ORION_USER ?? "orion@conejeros-solutions.cl";
    const gmailPass = process.env.GMAIL_ORION_PASS ?? "";

    if (gmailPass) {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
      });

      const fechaLegible = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CL", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      await transporter.sendMail({
        from: `"Orion.AI" <${gmailUser}>`,
        to: email,
        cc: notifyEmail,
        subject: `Tu demo de Orion.AI está confirmada — ${fechaLegible} ${hora}h`,
        html: `
          <h2>¡Hola ${nombre}!</h2>
          <p>Tu videollamada de demo con Orion.AI está confirmada.</p>
          <p><strong>📅 Fecha:</strong> ${fechaLegible} a las ${hora}h (hora Chile)</p>
          <p><strong>🎥 Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>
          <p>En la llamada verás exactamente cómo Orion funciona para ${clinica} y resolveremos todas tus dudas.</p>
          <br>
          <p>¡Nos vemos pronto!<br><strong>Equipo Orion.AI</strong><br>conejeros-solutions.cl</p>
        `,
      });
    }

    // Marca la conversación como "agendado" en el embudo
    if (ctx?.conversationId) {
      try { setEstado(ctx.conversationId, "agendado"); } catch { /* no bloquear */ }
    }

    return {
      ok: true,
      meetLink,
      eventLink,
      message:
        `Videollamada agendada. Google Meet: ${meetLink}. ` +
        `Email de confirmación enviado a ${email}.`,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: "Error al agendar: " + msg };
  }
}
