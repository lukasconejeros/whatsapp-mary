# 02 — Conectar WhatsApp

## Arrancar el bot

```bash
npm run start:all
```

Abre `http://localhost:3000` — aparecerá el QR.

## Escanear el QR

1. Abre WhatsApp en tu móvil
2. Ve a **Dispositivos vinculados** → **Vincular un dispositivo**
3. Escanea el QR
4. El panel mostrará "Agente conectado" con tu número

## Notas importantes

- Prueba siempre desde **otro móvil** — los mensajes del número vinculado se ignoran
- Los QR caducan en ~60 segundos. Si caduca, recarga la página
- WhatsApp 2025+ usa LIDs (`@lid`) — el kit los soporta automáticamente
- La sesión se guarda en `auth/` — no la borres a menos que quieras desconectarte

## Desconectar

Botón "Desconectar" en el panel o `POST /api/connection/disconnect`.
Borra la sesión y genera un QR nuevo en el siguiente arranque.
