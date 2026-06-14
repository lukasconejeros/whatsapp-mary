---
description: Primera instalación del WhatsApp AI Agent Kit. Instala dependencias, configura la API key de OpenRouter y conecta WhatsApp.
---

# /setup — Primera instalación

Ejecuta estas fases en orden. No pasar a la siguiente hasta completar la actual.

## Fase A — Validación silenciosa

Ejecuta en silencio (no preguntes, solo interrumpe si algo falla):

1. `node --version` — debe ser >= 20. Si no: "Necesitas Node.js 20+. Descárgalo desde nodejs.org"
2. `npm --version` — debe existir.
3. Detectar SO con `process.platform` para adaptar comandos posteriores.
4. Verificar >= 500 MB libres (usa `npm run check` para esto).

## Fase A.5 — Saludo contextual

- Si existe `data/messages.db` → "Ya tienes el kit instalado. ¿Quieres reconectar WhatsApp o personalizar el agente?"
- Si no → "¡Vamos a montar tu agente de WhatsApp! Esto tardará unos minutos."

## Fase B — Instalación de dependencias

1. Ejecuta `npm install`.
   - Si falla con `ERR_INVALID_ARG_TYPE` o `reify` o `rollback` → es `node_modules` corrupto, NO problema de dependencias. Borra `node_modules/` y reinstala. Ver `errores-sesion.md #13`.
2. Ejecuta `npm run typecheck` — debe salir exit 0. Si no, reporta los errores.
3. **Windows solamente**: si falla `better-sqlite3`, ejecuta `npm rebuild better-sqlite3` (requiere Visual Studio Build Tools).
4. Ejecuta `npm run build` — **OBLIGATORIO** porque `start:all` usa `next start` en modo producción.

## Fase C — Configurar OpenRouter

1. Pregunta: "¿Tienes cuenta en OpenRouter? (openrouter.ai)"
   - Si no: "Crea tu cuenta en https://openrouter.ai, añade crédito (5-10$ para empezar) y genera una API key."
2. Pide la API key (formato `sk-or-v1-...`).
3. Crea o edita `.env.local`, conservando otras variables existentes. Escribe `OPENROUTER_API_KEY=<valor>`.
4. **VALIDA** la key llamando a la función `validateApiKey()` de `src/lib/openrouter.ts` o corriendo un script de prueba.
   - Si devuelve 401 → "La key es inválida. Verifica que la copiaste completa desde openrouter.ai/keys"
   - Si devuelve ok → continúa.
5. **NUNCA** escribas la key sin validarla primero.

## Fase D — Conectar WhatsApp

1. Arranca el bot: `npm run start:all` (en background).
2. Polling de la tabla `connection_state` (id=1) cada 3 segundos, máximo 2 minutos:
   - Hasta que `status = 'connected' AND phone IS NOT NULL`.
3. Abre `http://localhost:3000` para que el usuario vea el QR.
4. Instrucciones: "Abre WhatsApp en tu móvil → Dispositivos vinculados → Vincular dispositivo → Escanea el QR"
5. Si el bot no arranca con `start:all`, fallback: `npm run start:bot` en una terminal y `npm run dev` en otra.

## Fase E — Prueba

1. "Escribe 'hola' desde OTRO móvil al número que acabas de vincular."
   - **Importante**: los mensajes desde el propio número vinculado se ignoran a propósito.
   - WhatsApp 2025+ usa LIDs internamente — si no responde, revisa `errores-sesion.md` sección @lid.
2. Confirma que el agente responde con el prompt genérico.
3. Sugiere ejecutar `/personaliza` para entrenar el agente con los datos del negocio.
