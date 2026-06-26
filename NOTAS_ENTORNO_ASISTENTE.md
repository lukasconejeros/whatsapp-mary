# 📝 Notas — Variables de Entorno para el Asistente (chat con IA)

Estas son las llaves que hay que poner para que el **Asistente** (el chat con IA dentro de la app) funcione.[text](vscode-webview://1aikgdpjic3p3squ6fc3tulm6dcfp91b200c2drl5cai3gh53vqq/whatsapp-mary/NOTAS_ENTORNO_ASISTENTE.md)

---

## En EasyPanel → pestaña **Entorno** (producción)

Agrega estas **2 variables nuevas** (una por línea):

```
ANTHROPIC_API_KEY=pega-aquí-tu-llave-de-anthropic
OPENAI_API_KEY=pega-aquí-tu-llave-de-openai
```

- **`ANTHROPIC_API_KEY`** → es la del **chat** (modelo Sonnet). **Ya está lista y probada** (funciona). La tienes en la hoja `ENTORNO-EASYPANEL.local.txt` lista para copiar/pegar.
- **`OPENAI_API_KEY`** → es la que **transcribe los audios** (Whisper). **Falta**: la única que había en el proyecto está vencida. Sin ella, el texto anda pero el micrófono no. Saca una nueva en platform.openai.com.

> 📋 Para copiar/pegar rápido con la llave de Anthropic ya incluida, usa el archivo **`ENTORNO-EASYPANEL.local.txt`** (no se sube a GitHub).
>
> 💻 Nota solo-local: en tu compu hay una variable global de Windows `ANTHROPIC_API_KEY` vencida que pisa a la del proyecto y hace fallar el chat al probar local. En EasyPanel (producción) eso no pasa.

> ⚠️ No borres las variables que ya están (como `OPENROUTER_API_KEY`). Solo **agrega** estas dos.

Después de guardar, EasyPanel reinicia el servicio solo. Listo.

---

## En tu computador (para probar local) → archivo `whatsapp-mary/.env.local`

Mismas dos líneas:

```
ANTHROPIC_API_KEY=pega-aquí-tu-llave-de-anthropic
OPENAI_API_KEY=pega-aquí-tu-llave-de-openai
```

(La `ANTHROPIC_API_KEY` ya está puesta en el `.env.local` local, pero es la vencida — hay que reemplazarla por la nueva. La `OPENAI_API_KEY` falta agregarla.)

---

## Dónde saco cada llave

| Llave | De dónde | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | El chat (responde y registra) |
| `OPENAI_API_KEY` | platform.openai.com → API Keys | Transcribir los audios |

## Seguridad
- **No pegues estas llaves en el chat conmigo.** Pégalas tú directo en EasyPanel y en el `.env.local`.
- El `.env.local` ya está protegido (gitignored): nunca se sube a GitHub.

---

## Recordatorio para desplegar
Para subir el código nuevo del Asistente a producción falta un **token de GitHub nuevo** (el anterior murió). Sin eso, el código queda listo en local pero no llega a EasyPanel.
