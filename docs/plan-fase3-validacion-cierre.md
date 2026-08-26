# Plan — Fase 3: Validación End-to-End y Cierre

**Fecha:** 26/08/2026
**Estado:** PROPUESTO — pendiente de autorización del usuario fase por fase
**Dependencias:** Fase 2.5 completada (BD + admin + secretos + deploy + smoke tests + RLS verificado)

---

## 1. Contexto

La infraestructura de AuthCenter está operativa:
- BD con 3 productos semillados (AUTOSTOCK, MEDSTOCK, POSADAS)
- Admin dado de alta (auth + usuarios + metadata JWT)
- 3 secretos de producto configurados
- Edge Functions desplegadas (`create-license`, `validate-license`)
- Smoke tests de `validate-license` pasados (formato_invalido, producto_invalido, firma_invalida)
- RLS activo: anon no puede leer `aut_licenses`

**Lo que falta:** probar el ciclo completo de vida de una licencia (creación → validación) y preparar la integración de Gallos-los-indios.

---

## 2. Fases de ejecución

### Fase 3.1 — Test end-to-end `create-license` → `validate-license`

| Tarea | Descripción | Complejidad | Riesgo |
|-------|-------------|-------------|--------|
| 3.1.1 | Obtener JWT de admin real: login en el panel temporal o usar `supabase auth signInWithPassword` para generar un access_token con el rol admin | media | bajo |
| 3.1.2 | Ejecutar `POST /functions/v1/create-license` con JWT de admin y body `{ "producto": "AUTOSTOCK", "cliente": "TestAuto", "tipo": "demo", "duracion_dias": 30 }` | baja | bajo |
| 3.1.3 | Verificar que la respuesta contenga `license_key` con formato XXXX-XXXX-XXXX-XXXX-XXXX y que se haya insertado en `aut_licenses` con `producto_id` correcto | baja | bajo |
| 3.1.4 | Ejecutar `POST /functions/v1/validate-license` con la `license_key` recibida y `producto: "AUTOSTOCK"` → esperar `valida: true, estado: "activa"` | baja | bajo |
| 3.1.5 | Ejecutar `validate-license` con la misma clave pero `producto: "MEDSTOCK"` → esperar `estado: "desconocida"` (clave pertenece a otro producto) | baja | bajo |
| 3.1.6 | Ejecutar `validate-license` sin `license_key` → esperar `formato_invalido` | baja | bajo |

**Criterio de aceptación:** las 6 tareas pasan. La licencia se crea, se valida y se rechaza correctamente al cambiar de producto.

---

### Fase 3.2 — Gallos-los-indios como 4to producto

| Tarea | Descripción | Complejidad | Riesgo |
|-------|-------------|-------------|--------|
| 3.2.1 | Script SQL: `INSERT INTO public.productos (codigo, nombre, activo) VALUES ('GALLOSLOSINDIOS', 'Gallos los Indios', true)` — idempotente (ON CONFLICT DO NOTHING) | baja | bajo |
| 3.2.2 | Generar 4to secreto hex (64 chars) → `LICENSE_SECRET_GALLOSLOSINDIOS` | baja | bajo |
| 3.2.3 | Configurar el secreto via Dashboard UI (misma limitación de permisos CLI detectada en Fase 2.5) | baja | bajo |
| 3.2.4 | Verificar: `supabase secrets list` (sin exponer valores en chat) | baja | bajo |
| 3.2.5 | Test rápido: crear licencia para GALLOSLOSINDIOS y validarla | baja | bajo |

**Criterio de aceptación:** Gallos-los-indios aparece en `productos`, tiene su secreto, y puede crear/validar licencias.

---

### Fase 3.3 — Limpieza AutoStock (pendiente externo)

| Tarea | Descripción | Complejidad | Riesgo |
|-------|-------------|-------------|--------|
| 3.3.1 | Ejecutar `scripts/AUTOSTOCK-limpieza-aut_licenses.sql` en el proyecto **AutoStock** (NO en AuthCenter) | media | medio (BD viva de otro proyecto) |
| 3.3.2 | Verificar que la tabla `aut_licenses` de AutoStock quedó limpia | baja | bajo |

**Criterio de aceptación:** AutoStock listo para apuntar a AuthCenter como emisor central.

---

### Fase 3.4 — Checkpoint y cierre

| Tarea | Descripción | Complejidad | Riesgo |
|-------|-------------|-------------|--------|
| 3.4.1 | Actualizar `memory.md` con el estado final de la sesión | baja | bajo |
| 3.4.2 | Commit `checkpoint:` con el avance | baja | bajo |

---

## 3. Riesgos conocidos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| CLI Supabase con permisos limitados (403 en secrets/deploy) | Medio | Usar Dashboard UI como workaround; resolver permisos de org a futuro |
| Secrets expuestos en chat por error | Alto | **No ejecutar `secrets list` en el chat.** Si es necesario verificar, hacerlo fuera del chat |
| JWT de admin no funciona para `create-license` | Medio | Verificar que el JWT tenga `rol: admin` en `user_metadata` y que la tabla `usuarios` tenga la fila correspondiente |
| AutoStock con tabla `aut_licenses` corrupta | Medio | Ejecutar limpieza ANTES de integrar ese cliente |

---

## 4. Orden de ejecución recomendado

```
3.1 (test E2E) → 3.2 (Gallos) → 3.3 (limpieza AutoStock) → 3.4 (checkpoint)
```

**Total estimado:** 13 tareas, complejidad baja-media, riesgo bajo-medio.

¿Autorizas la Fase 3.1?
