# 03 — Personalizar el prompt del agente

## Cómo funciona

El agente lee `prompts/negocio.md` en cada conversación y lo inyecta como system prompt.
Si el fichero no existe, usa un prompt genérico.

## Crear negocio.md (recomendado)

```
/personaliza
```

Claude te hace 6 preguntas y genera el fichero automáticamente.

## Editar manualmente

Copia `prompts/negocio.example.md` a `prompts/negocio.md` y edítalo.
El fichero debe tener estas 6 secciones:

```
## Nombre
## A qué se dedica
## Propuesta de valor
## Preguntas de calificación al lead
## Criterios de lead bueno vs malo
## Acción cuando el lead encaja
```

## Aplicar cambios

Los cambios en `negocio.md` requieren **reiniciar el bot**:

```bash
# Opción rápida: escribe el flag de restart
echo "" > data/.restart

# O reinicia manualmente
# Ctrl+C → npm run start:all
```

Con `/personaliza`, el reinicio es automático.

## Ver ejemplos

- `prompts/ejemplos/agencia-ia.md`
- `prompts/ejemplos/ecommerce.md`
- `prompts/ejemplos/infoproducto.md`
