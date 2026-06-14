# prompts/ — Cómo personalizar tu agente

## El fichero `negocio.md`

El fichero `prompts/negocio.md` contiene toda la información de tu negocio que el agente usa para responder, calificar leads y agendar.

**Cómo crearlo o modificarlo:**

1. **Recomendado**: Usa el comando `/personaliza` en Claude Code. Te guía paso a paso con una pregunta a la vez.
2. **Manual**: Copia `negocio.example.md` a `negocio.md` y edítalo siguiendo el formato.
3. **Ejemplo**: Copia uno de los ficheros de `ejemplos/` como punto de partida.

## Cómo se usa

El fichero se inyecta automáticamente en el system prompt del agente en cada conversación. Si no existe, el agente usa un prompt genérico.

**Importante**: Cambiar `negocio.md` requiere **reiniciar el bot** para que los cambios tengan efecto. Con `/personaliza`, el reinicio es automático.

## Formato requerido

El fichero debe tener exactamente estas 6 secciones:

```
## Nombre
## A qué se dedica
## Propuesta de valor
## Preguntas de calificación al lead
## Criterios de lead bueno vs malo
## Acción cuando el lead encaja
```
