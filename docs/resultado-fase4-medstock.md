# Resultado — Smoke Test Fase 4.4-M-D: MedStock ← AuthCenter

**Fecha de ejecución:** ___ / ___ / 2026
**Responsable:** Usuario final
**Instalación probada (URL/cliente):** _______________________

> Plantilla oficial del plan `docs/plan-fase4-medstock.md` (D.3). Marcar ✅ / ❌ y anotar resultado en cada caso.

## Requisitos previos

- [ ] Licencia MEDSTOCK emitida en el panel AuthCenter (D.1) — cliente/instalación: ______________
- [ ] MedStock desplegado en Vercel con `NEXT_PUBLIC_AUTHCENTER_URL` y `NEXT_PUBLIC_AUTHCENTER_PRODUCTO=MEDSTOCK` (D.2)
- [ ] Secreto `LICENSE_SECRET_MEDSTOCK` configurado en AuthCenter (D4, ≥32 chars)
- [ ] ALTER `scripts/alter-aut_licenses-cache-d6.sql` ejecutado en Supabase **MedStock** (ref `rrngvryilxnzffciioao`)

## Prueba 1 — Instalación de clave

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 1.1 | Abrir instalación sin activar (borrar localStorage) | Redirige a `/license` | |
| 1.2 | Pegar clave emitida (formato 20 hex) | Acepta, valida contra centro, carga `/dashboard` | |
| 1.3 | Revalidar (recargar) | No vuelve a pedir clave | |

## Prueba 2 — Validación de estado

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 2.1 | `validate-license` con clave del producto | `estado: activa`, días restantes correctos | |
| 2.2 | GET `/api/license/status` (panel admin) | Muestra activa, vence, días restantes | |
| 2.3 | Banner con ≤30 días | Aviso ámbar visible | |

## Prueba 3 — Gracia offline (D6)

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 3.1 | Validar OK con clave; luego **desconectar red** | Caché sirve durante gracia 72 h (no bloquea) | |
| 3.2 | Recargar sin red dentro de la gracia | App usa `gracia_offline`, no bloquea | |
| 3.3 | Recargar sin red tras >72 h (o caché expirada) | Bloquea / redirige correctamente | |

## Prueba 4 — Control desde el panel central

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 4.1 | Revocar licencia en AuthCenter → validar en MedStock | `revocada`, bloquea acceso | |
| 4.2 | Reactivar licencia → validar en MedStock | Vuelve a permitir | |
| 4.3 | Expirada (si aplica) | `expirada`, bloquea / pide renovación | |

## Prueba 5 — Estados de error / borde

| Paso | Acción | Resultado esperado | Resultado |
|------|--------|--------------------|-----------|
| 5.1 | Clave inválida / firma errónea | `firma_invalida`, mensaje claro en `/license` | |
| 5.2 | Clave de otro producto | `producto` no coincide, rechaza | |
| 5.3 | Rate limit (30/min) | HTTP 429 con `retry-after` | |
| 5.4 | AuthCenter caído (forzado) | `offline_sin_gracia` si sin caché; fail-closed | |

## Conclusión

- [ ] Todas las pruebas ejecutadas pasan
- Observaciones / incidencias: _______________________
- Licencia emitida: _______________________
- Acciones pendientes: _______________________