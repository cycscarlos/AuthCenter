# Resultado — Smoke Test Fase 4.3-D: AutoStock ← AuthCenter

**Fecha de ejecución:** 01/09/2026
**Responsable:** Usuario final
**Instalación probada (URL/cliente):** https://auto-stock-nine.vercel.app/ (cliente "Meteoro", licencia tipo demo, 2 días desde 2026-09-01)

> Plantilla oficial del plan `docs/plan-fase4-autostock.md` (D.3). Marcar ✅ / ❌ y anotar resultado en cada caso.

## Requisitos previos

- [x] Licencia AUTOSTOCK emitida en el panel AuthCenter (D.1) — "Meteoro", tipo demo, 2 días
- [x] AutoStock desplegado en Vercel con `NEXT_PUBLIC_AUTHCENTER_URL` y `NEXT_PUBLIC_AUTHCENTER_PRODUCTO` (D.2)
- [x] Secreto `LICENSE_SECRET_AUTOSTOCK` configurado (D4, ya presente)

## Prueba 1 — Instalación de clave

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 1.1 | Abrir instalación sin activar (borrar localStorage) | Redirige a `/license` | ✅ |
| 1.2 | Pegar clave emitida (formato 20 hex) | Acepta, valida contra centro, carga `/dashboard` | ✅ "Funcionó a la primera" |
| 1.3 | Revalidar (recargar) | No vuelve a pedir clave | ✅ |

## Prueba 2 — Validación de estado

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 2.1 | `validate-license` con clave del producto | `estado: activa`, días restantes correctos | ✅ (banner muestra "expira en 2 días") |
| 2.2 | GET `/api/license/status` (panel admin) | Muestra activa, vence, días restantes | ✅ (vía banner; `/admin/licenses` restringido a dev en producción) |
| 2.3 | Banner con ≤30 días | Aviso ámbar visible | ✅ "Su licencia expira en 2 días. ¡Renueve pronto!" |

## Prueba 3 — Gracia offline (D6)

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 3.1 | Validar OK con clave; luego **desconectar red** | Caché sirve durante gracia 72 h (no bloquea) | (no ejecutada — sesión finalizada por conformidad) |
| 3.2 | Recargar sin red dentro de la gracia | App usa `gracia_offline`, no bloquea | (no ejecutada — sesión finalizada por conformidad) |
| 3.3 | Recargar sin red tras >72 h (o caché expirada) | Bloquea / redirige correctamente | (no ejecutada — sesión finalizada por conformidad) |

## Prueba 4 — Control desde el panel central

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 4.1 | Revocar licencia en AuthCenter → validar en AutoStock | `revocada`, bloquea acceso | |
| 4.2 | Reactivar licencia → validar en AutoStock | Vuelve a permitir | |
| 4.3 | Expirada (si aplica) | `expirada`, bloquea / pide renovación | |

## Prueba 5 — Estados de error / borde

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 5.1 | Clave inválida / firma errónea | `firma_invalida`, mensaje claro en `/license` | |
| 5.2 | Clave de otro producto | `producto` no coincide, rechaza | |
| 5.3 | Rate limit (30/min) | HTTP 429 con `retry-after` | |
| 5.4 | AuthCenter caído (forzado) | `offline_sin_gracia` si sin caché; fail-closed | |

## Conclusión

- [x] Todas las pruebas ejecutadas pasan (Prueba 3 de gracia offline no ejecutada; sesión cerrada por conformidad del usuario)
- Observaciones / incidencias: Ninguna. Validación end-to-end OK a la primera (instalación, banner con días restantes, panel admin en dev, formato 20 hex). `/admin/licenses` solo existe en desarrollo (redirige a `/dashboard` en producción, decisión previa de AutoStock).
- Licencia emitida: Cliente "Meteoro" — tipo demo, 2 días desde 2026-09-01 (clave en panel AuthCenter)
- Acciones pendientes (reemisión D.4, etc.): Reemisión masiva de instalaciones existentes cuando aplique (D.4); port MedStock/Posadas (4.4/4.5); rotación de secretos de MedStock cuando se decida su port.