---
description: Configura el agente de IA con los datos del negocio del usuario. Una pregunta a la vez.
---

# /personaliza — Personalizar el agente

Patrón conversacional: **UNA pregunta a la vez**. Nunca las 6 de golpe.

## Comprobación inicial

- Si `prompts/negocio.md` ya existe → presenta 3 opciones:
  1. Sobrescribir completamente
  2. Editar una sección puntual
  3. Cancelar
- Si no existe → continúa con las preguntas.

## Las 6 preguntas (en este orden, una por una)

1. **Nombre del negocio**: "¿Cómo se llama tu negocio?"
2. **Actividad**: "¿A qué se dedica en una frase? (ej: 'Agencia de automatización con IA para PYMEs')"
3. **Propuesta de valor**: "¿Qué resultado concreto consiguen tus clientes? (ej: 'Ahorran 20h/semana automatizando tareas repetitivas')"
4. **Preguntas de calificación**: "¿Qué preguntas le harías a un lead para saber si encaja? (dame al menos 2)"
   - Si da menos de 2 → pide más: "Dame al menos 2 preguntas para tener un criterio sólido."
5. **Criterios lead bueno/malo**: "¿Cómo es un lead ideal para ti? ¿Y uno que NO encaja?"
6. **Acción cuando encaja**: "Cuando el lead encaja, ¿qué quieres que haga el agente?"
   - Opciones: enviar link Cal.com/Calendly, link de pago, derivar a humano.
   - Si elige Cal.com → "Pega el link de tu evento de Cal.com". Guarda en `CAL_BOOKING_URL` en `.env.local`.

## Escribir negocio.md

1. Muestra un **resumen** de las 6 respuestas y pregunta: "¿Todo correcto? (sí/no/corregir X)"
2. Si confirma → escribe `prompts/negocio.md` con este formato:

```markdown
---
nombre: [Nombre del negocio]
actividad: [actividad]
generado: [ISO timestamp]
---

# Datos del negocio

## Nombre
[nombre]

## A qué se dedica
[actividad en una frase]

## Propuesta de valor
[resultado concreto]

## Preguntas de calificación al lead
[lista de preguntas]

## Criterios de lead bueno vs malo
**BUENO**: [criterios]
**MALO**: [criterios]

## Acción cuando el lead encaja
[acción concreta con link si aplica]
```

3. Valida que el fichero tiene las 6 secciones H2.
4. **Reinicia el bot**: escribe el fichero `data/.restart` o reinicia `npm run start:all`.
5. Instrucciones de prueba: "Escribe 'hola' al número desde otro móvil para probar el agente entrenado."
