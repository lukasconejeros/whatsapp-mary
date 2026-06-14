# 04 — Configurar las herramientas del agente

El agente tiene 4 herramientas. Dos requieren configuración en `.env.local`.

## guardarLead

Guarda leads en Google Sheets vía webhook.

**Configurar:**
1. Crea un Google Apps Script con `doPost(e)` que escriba en tu hoja
2. Publica como aplicación web (acceso: cualquiera)
3. Copia la URL a `.env.local`:

```
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/AKfy.../exec
```

Si la variable está vacía, la herramienta devuelve `ok:false` sin lanzar error.

## calificar

No requiere configuración. Evalúa al lead con 5 criterios booleanos (score 0-10).
Un score >= 7 habilita el agendamiento.

Los pesos están en `src/lib/tools/calificar.ts` con un `// TODO` para ajustarlos.

## agendar

Genera un link de Cal.com con nombre/email pre-rellenado.

**Configurar:**
```
CAL_BOOKING_URL=https://cal.com/tu-usuario/diagnostico
```

Si la variable está vacía, la herramienta devuelve el link sin pre-rellenar datos.

## derivarHumano

No requiere configuración. Cambia la conversación a Modo HUMAN automáticamente.
El agente la usa cuando el lead pregunta por precios específicos, hace quejas, o algo está fuera de su alcance.
