---
description: Despliega el agente en producción 24/7 usando Hostinger VPS + EasyPanel + Nixpacks + Cloudflare Access.
---

# /deploy — Despliegue en producción

## Parte 0 — Repositorio GitHub (ANTES de subir nada)

1. Verifica: `git --version` y `gh auth status`.
2. Tres caminos:
   - **gh autenticado** → `gh repo create whatsapp-ai-agent-kit --private --source=. --remote=origin --push`
   - **gh sin login** → `gh auth login` primero
   - **Sin gh** → crear repo manual en github.com con Personal Access Token (fine-grained, Contents: Read & Write)
3. **El repositorio siempre es PRIVADO** — nunca público.

## Verificación de seguridad OBLIGATORIA

Antes del primer commit:
- `git status --short` — verifica que NO aparezcan `.env.local`, `data/`, `auth/`
- El `.gitignore` ya los excluye; `.env.example` SÍ se sube.
- Si aparecen → DETENER y corregir antes de continuar.

## VPS + EasyPanel

1. **Contratar VPS Hostinger**: Ubuntu 24.04 con Docker. Recomendado KVM 2 (2 vCPU, 8GB RAM, ~8€/mes).
   - El cuello de botella son las vCPU, no la RAM (~150MB/agente pero CPU alta en WebSocket+cifrado).
2. **Instalar EasyPanel** (self-hosted Developer, GRATIS):
   ```
   docker run --rm -it -v /etc/easypanel:/etc/easypanel -v /var/run/docker.sock:/var/run/docker.sock:ro easypanel/easypanel setup
   ```
   Panel disponible en `http://<IP>:3000`.
3. En EasyPanel: Create → App → Source: GitHub → Branch: main → Build path: `/` → Builder: **Nixpacks** (autodetecta por `nixpacks.toml`).

## Volúmenes persistentes CRÍTICOS ⚠️

Configurar ANTES de hacer Deploy (es la causa #1 de problemas en producción):

| Ruta del contenedor | Propósito |
|---|---|
| `/app/data` | SQLite + conversaciones |
| `/app/auth` | Sesión WhatsApp — sin esto se re-escanea QR en cada redeploy |

## Variables de entorno en EasyPanel

Añadir las mismas de `.env.local`:
- `OPENROUTER_API_KEY` (obligatoria)
- `OPENROUTER_MODEL` (recomendado explicitar)
- `GOOGLE_SHEETS_WEBHOOK_URL` (si usas la tool de leads)
- `CAL_BOOKING_URL` (si usas agendamiento)

⚠️ **Aviso**: Las env vars en EasyPanel se inyectan como `--build-arg` y aparecen en TEXTO PLANO en el log de build. Si compartes el log, rota la key.

## Cloudflare Access — OBLIGATORIO (paso bloqueante)

**Nunca deployar sin protección**. El panel expone todas las conversaciones de WhatsApp.

1. Cloudflare Zero Trust → Access → Applications → Self-hosted
2. `Application domain = panel.tu-dominio.com`
3. Policy: Allow. Include → Emails (lista tu email) o "Emails ending in @tudominio.com"
4. Identity provider: **Email One-Time PIN** (recomendado — sin OAuth de Google, cero configuración)
5. **Verificar en incógnito** con un email NO autorizado → debe rechazar. Si no rechaza, hay un error de config.

Alternativa sin dominio propio: usar `*.easypanel.host` con Basic Auth en la propia app.

## Deploy y redeploy

- **Primer deploy**: `git push origin main` → EasyPanel detecta el push y despliega automáticamente (3-5 min; compila `better-sqlite3` nativo y Next.js).
- **Redeploy**: `git push` a main → redeploy automático.
- **Escanear QR en producción**: abrir la URL del panel, escanear QR desde la app de WhatsApp.

## Nota sobre Nixpacks

Nixpacks está en modo mantenimiento (Railway lanzó Railpack como sucesor). Si en 12-18 meses el build falla, migrar a Dockerfile — EasyPanel lo soporta. Déjalo anotado en el proyecto.
