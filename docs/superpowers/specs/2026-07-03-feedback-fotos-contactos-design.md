# Arteluk — Feedback con fotos, contactos y sugerencias IA

Fecha: 2026-07-03 · Rama: `feat/feedback-fotos` · Repo: `lukasconejeros/whatsapp-mary`

> Sesión autónoma (Lukas durmiendo, dio vía libre). Todo va en rama aparte,
> **sin push a `main` ni deploy** — Lukas revisa en la mañana.

## Contexto

La app de Arteluk (`whatsapp-mary`, Next.js + Baileys, EasyPanel) ya:
- Recibe fotos/audios/videos y foto de perfil; envía **solo texto**.
- Tiene un **Asistente IA in-app** (`/asistente`) con acciones `registrar` / `agendar`
  (Anthropic directo, `claude-sonnet-4-6`), entrada por texto y audio.
- Clasifica contactos en `mary` / `arteluk` (número en tabla `clientes`) / `potencial` (Meta CTWA).
- Tiene botón "Sugerir respuesta" (`/api/suggest`) que apunta a OpenRouter → **roto en prod**.
- Tema **rosita pink** con fondo `#FFF4FA`.

## Alcance (5 mini-proyectos). Orden: B → A → C → E. (D push = después)

### B — Contactos + etiqueta activo/inactivo
- **Importar** ~65 apoderados (lista de Lukas) a `clientes`: `nombre`=apoderado,
  `alumnos`=niño(s), `estado`='activo'. Normaliza teléfono chileno, dedup por teléfono
  (upsert), **reporta** inválidos. Script `scripts/import-contactos-arteluk.ts` idempotente.
  - Inválidos conocidos: Ema Delgado Castro (nº 15 dígitos), Mateo Godoy Flores (sin nº),
    Sophia Iturra Sandoval (nº 12 dígitos). Duplicado: Alexie Paredes (upsert lo absorbe).
- **Etiqueta activo/inactivo**: se reutiliza `clientes.estado ∈ {activo, inactivo}`.
  `setClienteEstado(telefono, estado)` + `listContactos()` (todos los campos).
- **Pantalla `/contactos`**: lista de clientes (apoderado · niño · teléfono · chip de estado
  con toggle activo↔inactivo, buscador). Nuevo ítem de menú "Contactos".

### A — Feedback con fotos asistido por IA (en el Asistente) ⭐
Flujo (Mary en `/asistente`, escribe o dicta + adjunta 1–3 fotos):
1. Mary: *"mensaje para la mamá de Amparo, se portó muy bien, hicimos un cuadro precioso"* + fotos.
2. La IA devuelve `accion:"preparar_envio"` con `destinatario` (término a buscar) y `mensaje` (borrador cálido, sin exagerar).
3. **Backend resuelve el contacto** (búsqueda difusa sobre `clientes.nombre` + `alumnos`, sin acentos):
   - 0 → responde *"No encontré a '{X}' 🤔 ¿Tendrá otro nombre, o quizás no lo tienes registrado?"* (no envía).
   - >1 → lista opciones y pide cuál (no envía).
   - 1 → crea un **borrador** (`feedbacks` estado='borrador' con `mensaje`+`fotos`+cliente) y pide confirmación mostrando el texto.
4. Mary confirma ("sí") → IA `accion:"enviar"` → backend toma el último borrador, **encola fotos + texto** al WhatsApp del apoderado, marca `enviado`.
5. **Envío de fotos**: `outbox` gana columnas `kind` ('text'|'image') y `media` (archivo en `data/media`).
   El loop de `baileys/outbox.ts` manda `{image, caption}` si `kind='image'` (cambio mínimo aditivo).
6. **Historial** ("ver lo que va enviando"): pantalla `/feedbacks` (o sección) que lista `feedbacks` enviados (contacto, texto, miniaturas, fecha).

Piezas:
- `outbox`: +`kind` +`media`; `enqueueOutbox(convId, phone, content, {kind, media})`; pending ordena `created_at, id`.
- `feedbacks` tabla: id, cliente_telefono, cliente_nombre, mensaje, fotos(JSON), estado('borrador'|'enviado'|'cancelado'), created_at, sent_at.
- `db`: `searchClientes(term)`, `createFeedbackBorrador`, `getFeedbackBorradorPendiente`, `marcarFeedbackEnviado`, `listFeedbacks`.
- `asistente.ts`: acciones nuevas `preparar_envio` / `enviar`; SYSTEM extendido (4ª capacidad); si hay fotos adjuntas, hint en el mensaje del user.
- `POST /api/asistente/foto` (multipart, guarda en data/media, devuelve nombre). `/api/asistente` POST acepta `fotos: string[]`.
- UI `/asistente`: botón 📎 adjuntar fotos (preview + quitar); envía nombres junto al texto.

### C — Sugerencias IA (arreglar + estratégicas)
- `/api/suggest` pasa de OpenRouter a **Anthropic directo** (`ANTHROPIC_API_KEY`, `claude-haiku-4-5`).
- Devuelve `{ suggestion }` (borrador de respuesta) **y** `{ tip }` (consejo estratégico corto:
  "lleva 3 días sin responder, ofrécele una promo" / "invítalo al taller del sábado").
  Pensado sobre todo para contactos **Meta** y **no activos**. UI muestra el tip encima del borrador.

### E — Fondo blanco tipo Waly + calendario móvil
- Fondo principal `#FFF4FA` → `#FFFFFF` en los contenedores de página (detalles rosados intactos:
  acentos `#EC4899`, bordes `#FAD1E5/#FDE7F1`, chips). Se conserva `#FFF4FA` solo en micro-acentos (hover/pie).
- Calendario: arreglar la grilla asimétrica en teléfono (<768px) — celdas cuadradas uniformes,
  scroll contenido, sin desbordes.

## Riesgos / seguridad
- `src/lib/baileys/` es "no tocar": el único cambio es **aditivo** en `outbox.ts` (rama `kind='image'`),
  preservando el envío de texto. Justificado: enviar fotos es requisito y no hay otra vía.
- Todo en rama `feat/feedback-fotos`, sin push/deploy. Validación: `typecheck` + tests + build.
- Import de contactos: correr en **local** para verificar; en prod lo corre Lukas (o vía endpoint admin) — no toco prod.

## Validación
- `npm run typecheck` exit 0.
- Tests existentes verdes + nuevos tests: `test-import-contactos`, `test-feedback` (search + borrador + no-encontrado).
- `npm run build` OK (Nixpacks-compatible).
