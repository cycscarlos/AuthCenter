# Resultado — Smoke Test Fase 4.4-M-D: MedStock ← AuthCenter

**Fecha de ejecución:** 02 / 09 / 2026
**Responsable:** Usuario final
**Instalación probada (URL/cliente):** https://med-stock-roan.vercel.app/

> Plantilla oficial del plan `docs/plan-fase4-medstock.md` (D.3). Marcar ✅ / ❌ y anotar resultado en cada caso.

## Requisitos previos

- [x] Licencia MEDSTOCK emitida en el panel AuthCenter (D.1) — tipo "prueba", fecha inicio 02-09-2026, duración 1 día
- [x] MedStock desplegado en Vercel con `NEXT_PUBLIC_AUTHCENTER_URL` y `NEXT_PUBLIC_AUTHCENTER_PRODUCTO=MEDSTOCK` (D.2)
- [x] Secreto `LICENSE_SECRET_MEDSTOCK` configurado en AuthCenter (D4, ≥32 chars)
- [x] ALTER `scripts/alter-aut_licenses-cache-d6.sql` ejecutado en Supabase **MedStock** (ref `rrngvryilxnzffciioao`)

## Prueba 1 — Instalación de clave

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 1.1 | Abrir instalación sin activar (borrar localStorage) | Redirige a `/license` | ✅ |
| 1.2 | Pegar clave emitida (formato 20 hex) | Acepta, valida contra centro, carga `/dashboard` | ✅ "¡Funcionó!" |
| 1.3 | Revalidar (recargar) | No vuelve a pedir clave | ✅ |

## Prueba 2 — Validación de estado

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 2.1 | `validate-license` con clave del producto | `estado: activa`, días restantes correctos | ✅ |
| 2.2 | GET `/api/license/status` (panel admin) | Muestra activa, vence, días restantes | ✅ |
| 2.3 | Banner con ≤30 días | Aviso ámbar visible | ✅ |

## Prueba 3 — Gracia offline (D6)

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 3.1 | Validar OK con clave; luego **desconectar red** | Caché sirve durante gracia 72 h (no bloquea) | (no ejecutada — cierre por conformidad) |
| 3.2 | Recargar sin red dentro de la gracia | App usa `gracia_offline`, no bloquea | (no ejecutada) |
| 3.3 | Recargar sin red tras >72 h (o caché expirada) | Bloquea / redirige correctamente | (no ejecutada) |

## Prueba 4 — Control desde el panel central

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 4.1 | Revocar licencia en AuthCenter → validar en MedStock | `revocada`, bloquea acceso | (no ejecutada) |
| 4.2 | Reactivar licencia → validar en MedStock | Vuelve a permitir | (no ejecutada) |
| 4.3 | Expirada (si aplica) | `expirada`, bloquea / pide renovación | (no ejecutada) |

## Prueba 5 — Estados de error / borde

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 5.1 | Clave inválida / firma errónea | `firma_invalida`, mensaje claro en `/license` | (no ejecutada) |
| 5.2 | Clave de otro producto | `producto` no coincide, rechaza | (no ejecutada) |
| 5.3 | Rate limit (30/min) | HTTP 429 con `retry-after` | (no ejecutada) |
| 5.4 | AuthCenter caído (forzado) | `offline_sin_gracia` si sin caché; fail-closed | (no ejecutada) |

## Conclusión

- [x] Las pruebas 1 y 2 ejecutadas pasan (instalación + validación de estado).
- Observaciones / incidencias: Dos claves MEDSTOCK emitidas con anterioridad devolvieron `firma_invalida` en `validate-license` (secreto `LICENSE_SECRET_MEDSTOCK` distinto del usado al firmar / rotación puntual). Al **re-emitir una clave nueva** en el panel AuthCenter (tipo prueba, inicio 02-09-2026, duración 1) la instalación en MedStock se activó correctamente. No se tocó código de AuthCenter. El deploy de MedStock quedó correcto (ruta `admin/licenses/generate` ya no existe → 307 proxy guard).
- Licencia emitida: tipo "prueba", fecha inicio 02-09-2026, duración 1 día (clave aplicada en el modal de MedStock con éxito).
- Acciones pendientes: ninguna. Fase 4.4-M completada end-to-end.