# 05 — Proteger el panel con Cloudflare Access

**Obligatorio antes de poner en producción.** El panel expone todas las conversaciones de WhatsApp.

## Configuración

1. Ve a [Cloudflare Zero Trust](https://one.dash.cloudflare.com)
2. **Access** → **Applications** → **Add an application** → **Self-hosted**
3. Rellena:
   - Application name: `WhatsApp Panel`
   - Application domain: `panel.tu-dominio.com` (o el subdominio que uses)
4. En **Policies**:
   - Policy name: `Allow team`
   - Action: `Allow`
   - Include → **Emails** → añade tu email (y los de tu equipo)
5. En **Login methods**:
   - Activa **Email One-Time PIN** (recomendado — sin OAuth, cero config)
6. Guarda y despliega

## Verificar que funciona

Abre una ventana de incógnito y visita `panel.tu-dominio.com`.
Debes ver la pantalla de autenticación de Cloudflare Access.
Prueba con un email NO autorizado — debe rechazarlo.

Si no rechaza, hay un error de política — revisa el paso 4.

## Alternativa sin dominio propio

Si usas el dominio de EasyPanel (`*.easypanel.host`), puedes proteger el panel con Basic Auth directamente en EasyPanel (Settings → Basic Auth de la app).
