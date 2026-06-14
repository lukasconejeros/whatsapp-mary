# 07 — Errores comunes

> Referencia completa en `errores-sesion.md` (13 errores documentados con síntoma, causa y solución).

## Diagnóstico rápido

```bash
npm run doctor
```

Revisa: API key, dependencias, TypeScript, estado de conexión, archivos de config, procesos zombie (Windows).

## Los 5 errores más frecuentes

| Error | Causa | Solución rápida |
|---|---|---|
| Bot no responde | Pruebas desde el número vinculado | Usar OTRO móvil |
| QR en loop (código 440) | Session duplicada / fingerprint | Borrar `auth/` + reiniciar |
| `SQLITE_BUSY` en build | db.ts no lazy | Ver `errores-sesion.md #5` |
| `better-sqlite3` falla en Windows | Falta Visual C++ Build Tools | `npm rebuild better-sqlite3` |
| Mensajes perdidos (2025+) | WhatsApp LID | El handler ya los soporta |

## Herramienta de check previo

```bash
npm run check
```

7 checks no bloqueantes. Ejecutar antes de abrir un issue.
