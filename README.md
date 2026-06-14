# WhatsApp AI Agent Kit

Kit llave en mano para montar un agente de IA en WhatsApp que atiende y califica leads automáticamente, con panel web de control.

## ¿Qué hace?

- Conecta tu número de WhatsApp por QR (sin API oficial de Meta)
- Responde mensajes automáticamente con IA, conociendo tu negocio
- Califica leads con 4 herramientas: guardar lead, calificar, agendar llamada, derivar a humano
- Panel web tipo bandeja de entrada: lista de conversaciones, toggle Modo IA/Humano, envío manual
- Despliegue 24/7 en VPS con EasyPanel + Nixpacks (sin Docker manual)

## Requisitos

- Node.js 22 (o >=20)
- Cuenta en [OpenRouter](https://openrouter.ai) con crédito (~5-10$ para empezar)
- Un número de WhatsApp para vincular (recomendado: SIM secundaria)
- VS Code con la extensión [Claude Code](https://claude.ai/code) (requiere Claude Pro ~20$/mes)

## 3 pasos para empezar

1. Abre esta carpeta en VS Code con Claude Code
2. Escribe `/setup` — instala todo y conecta WhatsApp
3. Escribe `/personaliza` — entrena el agente con tu negocio

Para desplegar 24/7: `/deploy`

## Fallback sin Claude Code

Si no tienes Claude Code, usa el wizard de consola:

```bash
npm run wizard
```

## Estructura del proyecto

```
src/lib/db.ts          — Base de datos SQLite (conversaciones, mensajes, estado)
src/lib/baileys/       — Conexión WhatsApp (cliente, handler, outbox)
src/lib/openrouter.ts  — Cliente IA con bucle de herramientas
src/lib/tools/         — 4 herramientas del agente
src/app/               — Panel web Next.js
scripts/               — Bot, wizard, diagnóstico
prompts/               — Personalización del agente (negocio.md)
```

## Stack

- **WhatsApp**: Baileys 6.7 (WhatsApp Web, sin API oficial)
- **IA**: OpenRouter (OpenAI SDK compatible) — gpt-4o-mini por defecto
- **DB**: better-sqlite3 (SQLite, sin servidor)
- **Panel**: Next.js 16 + Tailwind v4
- **Deploy**: Nixpacks + EasyPanel (Hostinger VPS)

## Tarifas de mercado (para cobrar a clientes)

| Servicio | Precio orientativo |
|---|---|
| Diagnóstico | 150–300 € |
| Implementación | 800–1.500 € |
| Mantenimiento | 80–200 €/mes |

## Comunidad y soporte

Accede a **La Tribu Divisual** para soporte, actualizaciones y recursos:
→ https://www.skool.com/la-tribu-divisual

## Nota importante

Este kit usa WhatsApp Web no oficial (Baileys). No está afiliado a WhatsApp ni a Meta.
Para uso comercial intensivo, considera la API oficial de WhatsApp Business.

**Licencia**: Uso exclusivo para miembros de La Tribu Divisual.
