# Guía Completa: de cero a producción

## Fase 1 — Instalación local

### Requisitos previos
- Node.js 22 instalado (descarga en nodejs.org)
- VS Code con extensión Claude Code
- Cuenta en OpenRouter con crédito (openrouter.ai)
- Un número de WhatsApp disponible para vincular

### Instalación
1. Abre esta carpeta en VS Code
2. Ejecuta `/setup` en Claude Code
3. Sigue las instrucciones — tardará 3-5 minutos

### Qué ocurre durante /setup
1. Se verifican los requisitos del sistema
2. Se instalan las dependencias con `npm install`
3. Se compila el proyecto con `npm run build`
4. Se configura tu API key de OpenRouter
5. Se arrancan bot y panel (`npm run start:all`)
6. Aparece el QR para vincular WhatsApp

---

## Fase 2 — Entrenar el agente

### Personalización con /personaliza
El comando `/personaliza` te guía para crear el fichero `prompts/negocio.md`, que contiene:
- Nombre y descripción del negocio
- Propuesta de valor
- Preguntas para calificar leads
- Criterios de lead bueno vs malo
- Qué hacer cuando el lead encaja

### Las 4 herramientas del agente
El agente tiene acceso a estas herramientas automáticamente:

| Herramienta | Cuándo se activa |
|---|---|
| `guardarLead` | En cuanto tiene nombre + teléfono del lead |
| `calificar` | Cuando tiene suficientes datos para evaluar |
| `agendar` | Solo si `calificar` devuelve score >= 7 |
| `derivarHumano` | Precios específicos, quejas, fuera de alcance |

### Modo IA vs Modo Humano
Cada conversación tiene un toggle en el panel:
- **Modo IA**: el agente responde automáticamente
- **Modo Humano**: tú escribes desde el panel; el agente no interviene

El agente puede cambiar a Modo Humano automáticamente via `derivarHumano`.

---

## Fase 3 — Despliegue en producción

### Arquitectura de producción
- **VPS Hostinger** (KVM 2, ~8€/mes): servidor donde corre todo
- **EasyPanel**: panel de control del VPS, gestiona el redeploy automático
- **Nixpacks**: compila el proyecto automáticamente desde el repositorio GitHub
- **Cloudflare Access**: protege el panel web con autenticación por email

### Pasos con /deploy
1. Crear repositorio GitHub privado
2. Configurar VPS + EasyPanel
3. Conectar el repo a EasyPanel
4. Configurar volúmenes persistentes (`/app/data` y `/app/auth`)
5. Añadir variables de entorno
6. Proteger con Cloudflare Access
7. Hacer el primer push y esperar el deploy

### Mantenimiento
- **Actualizaciones**: `git push origin main` → redeploy automático
- **Cambiar el prompt**: editar `prompts/negocio.md` + `git push`
- **Ver logs**: en EasyPanel → tu app → Logs
- **Reconectar WhatsApp**: abrir la URL del panel → escanear QR

---

## Fase 4 — Mantenimiento y monetización

### Monitoreo básico
- Revisa el panel de conversaciones diariamente
- Cuando una conversación lleva más de 30 minutos sin cerrar, considera cambiar a Modo Humano
- Rota la API key de OpenRouter cada 3-6 meses

### Costes estimados en producción
- VPS Hostinger KVM 2: ~8€/mes
- OpenRouter (gpt-4o-mini): ~0.15$/1M tokens (~5-15$/mes para volumen medio)
- Cloudflare: gratis (plan Free)
- **Total**: ~15-25€/mes

### Tarifas para cobrar a clientes
- Diagnóstico / auditoría: 150-300 €
- Implementación completa: 800-1.500 €
- Mantenimiento mensual: 80-200 €/mes

### Comunidad
Accede a La Tribu Divisual para actualizaciones, casos de uso y soporte:
→ https://www.skool.com/la-tribu-divisual
