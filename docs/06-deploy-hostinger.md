# 06 — Despliegue en Hostinger VPS + EasyPanel

> Guía detallada disponible en el comando `/deploy`. Este fichero es un resumen de referencia.

## Arquitectura

```
GitHub (privado) → EasyPanel (Nixpacks) → VPS Hostinger → Cloudflare Access
```

## Pasos resumidos

### 1. VPS Hostinger
- Plan recomendado: **KVM 2** (~8€/mes, 2 vCPU, 8GB RAM, Ubuntu 24.04 + Docker)
- El cuello de botella es CPU (WebSocket + cifrado), no RAM (~150MB/instancia)

### 2. EasyPanel
```bash
docker run --rm -it \
  -v /etc/easypanel:/etc/easypanel \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  easypanel/easypanel setup
```
Panel en `http://<IP>:3000`. Edición Developer: **GRATIS**.

### 3. Crear app en EasyPanel
- Source: GitHub (repo privado)
- Branch: `main`
- Builder: **Nixpacks** (detecta `nixpacks.toml` automáticamente)

### 4. Volúmenes persistentes (CRÍTICO antes del primer deploy)
| Ruta | Propósito |
|---|---|
| `/app/data` | SQLite + conversaciones |
| `/app/auth` | Sesión WhatsApp |

Sin volúmenes, se pierde todo en cada redeploy.

### 5. Variables de entorno
Añadir `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, y las opcionales.

### 6. Deploy
`git push origin main` → EasyPanel despliega automáticamente (3-5 min).

## Costes estimados
- VPS KVM 2: ~8€/mes
- OpenRouter (gpt-4o-mini): ~5-15$/mes
- Cloudflare: gratis
- **Total**: ~15-25€/mes

## Nota sobre Nixpacks
Nixpacks está en modo mantenimiento (Railway migró a Railpack). Si en 12-18 meses falla, migrar a Dockerfile — EasyPanel lo soporta sin cambios adicionales.
