# 08 — Coexistencia con WhatsApp en el móvil

## ¿Puedo usar el número vinculado normalmente?

Sí, pero con limitaciones. WhatsApp permite hasta 4 dispositivos vinculados simultáneamente (el móvil principal + 3 secundarios).

El kit ocupa uno de esos slots de "dispositivo vinculado".

## Mensajes que NO procesa el bot

- Mensajes que TÚ envías desde tu móvil al bot (fromMe = true)
- Mensajes de grupos (`@g.us`)
- Mensajes de broadcast (`@broadcast`)
- Mensajes de newsletters (`@newsletter`)
- Mensajes multimedia (audio, imágenes, stickers, documentos)

## Mensajes que SÍ procesa

- Mensajes de texto de conversaciones 1:1
- Tanto con JID `@s.whatsapp.net` como `@lid` (LID rollout 2025+)

## Recomendaciones

1. **Usa una SIM secundaria** para el agente. Evita vincular tu número personal principal.
2. **No uses el número del agente para comunicaciones personales** — los mensajes van al agente, no a ti.
3. Si usas la misma SIM para el agente y para uso personal, ten en cuenta que todos los mensajes entrantes los verá el bot (aunque filtra grupos y broadcast).

## Límite de mensajes

No hay límite técnico por parte del kit, pero WhatsApp puede banear números con comportamiento spam (muchos mensajes salientes en poco tiempo, mensajes no solicitados, etc.).

Para uso legítimo (responder solo a quienes escriben primero), el riesgo es muy bajo.
