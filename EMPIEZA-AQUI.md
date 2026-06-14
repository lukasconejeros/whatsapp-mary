# Empieza aquí

## 3 pasos para montar tu agente

### Paso 1 — Abre esta carpeta en VS Code con Claude Code

Abre VS Code, ve a File → Open Folder y selecciona esta carpeta.
Asegúrate de tener instalada la extensión Claude Code y estar logueado con Claude Pro.

> **Windows**: Si Claude Code no funciona, instala [Git for Windows](https://git-scm.com/download/win) — Claude Code requiere un shell compatible con Bash.

### Paso 2 — Escribe `/setup`

En el chat de Claude Code, escribe:

```
/setup
```

Claude te guiará para:
- Instalar las dependencias
- Configurar tu API key de OpenRouter
- Conectar tu número de WhatsApp escaneando un QR

### Paso 3 — Escribe `/personaliza`

```
/personaliza
```

Claude te hará 6 preguntas sobre tu negocio (una a la vez) y configurará el agente para que sepa de qué hablar, cómo calificar leads y qué hacer cuando alguien encaja.

---

## Para desplegar 24/7

Una vez que funciona localmente:

```
/deploy
```

Claude te guía para subirlo a un VPS de Hostinger con EasyPanel.

---

## Si no tienes Claude Code

Usa el wizard de consola como alternativa:

```bash
npm run wizard
```

---

## Soporte

¿Algo no funciona? Consulta `errores-sesion.md` o pregunta en La Tribu Divisual:
→ https://www.skool.com/la-tribu-divisual
