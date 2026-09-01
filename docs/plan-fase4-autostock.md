# Plan — Fase 4.3: Integración de AutoStock con AuthCenter

**Fecha:** 01/09/2026
**Estado:** PROPUESTO — pendiente de autorización del usuario para ejecutar (regla 1 de `config_session/rules.md`)
**Repos:** AuthCenter (emisor) ←→ AutoStock (cliente, `../AutoStock`)
**Autorización:** usuario confirmó migración completa + reemisión de claves + acceso al repo AutoStock (01/09).

---

## 1. Objetivo

Reemplazar el licenciador **local y autocontenido** de AutoStock por la validación contra el **emisor central AuthCenter** (`validate-license`), cumpliendo:

- **D4:** cada producto usa su propio secreto (`LICENSE_SECRET_AUTOSTOCK`) que el cliente **nunca posee**.
- **D6:** política offline del cliente (validar al iniciar + caché con gracia 72 h + revalidación 24 h + fail-closed en red).
- Eliminar el secreto compartido y el fallback inseguro hardcodeado (`dev_license_secret_insecure`).

## 2. Estado actual de AutoStock (licenciamiento)

| Pieza | Archivo | Modelo hoy |
|-------|---------|-----------|
| Guard global (prod) | `src/proxy.ts` | Consulta `aut_licenses` (service role) → redirige a `/license` si no hay activa o expiró |
| Activación | `src/app/api/license/activate/route.ts` | Verifica HMAC (`verifyLicenseKey`) + desactiva anteriores + upsert |
| Generación (dev) | `src/app/api/admin/licenses/generate/route.ts` + CLI `scripts/generate-license.ts` | Genera clave HMAC local, INSERT inactiva |
| Cripto | `src/lib/license.ts` | `verifyLicenseKey` + `extractExpiry` (HMAC-SHA256 con `LICENSE_SECRET`, fallback hardcodeado) |
| Banner aviso ≤30 días | `src/components/LicenseBanner.tsx` | Consulta `aut_licenses` client-side |
| Formulario activación | `src/app/license/page.tsx` | Envía clave → `/api/license/activate` |
| Panel admin licencias (dev) | `src/app/(dashboard)/admin/licenses/page.tsx` | Ver activa + generar |
| BD | tabla propia `aut_licenses` (proyecto Supabase `mdrpujjczrgmxhxyjfdw`) | Sin `producto_id`, una activa global, RLS desactivado |

**Nada referencia a AuthCenter hoy.** Formato de clave local: `XXXX-XXXX-XXXX-XXXX` (16 hex). Formato central: `XXXX-XXXX-XXXX-XXXX-XXXX` (20 hex). → Las claves actuales quedarán inválidas (reemisión acordada).

---

## 3. Arquitectura objetivo

```
┌───────────── AutoStock (Vercel) ─────────────┐      ┌──────── AuthCenter (Supabase) ────────┐
│  src/lib/authcenter-client.ts (D6)           │──HTTPS│  Edge Function validate-license        │
│    · validarLicencia(key, producto)          │──────▶│    · HMAC (LICENSE_SECRET_AUTOSTOCK)   │
│    · caché + gracia 72 h + revalidación 24 h │      │    · consulta aut_licenses central      │
│    · sin secretos (solo anon/público)        │  ◀────│    · responde estados + días restantes  │
└──────────────────────────────────────────────┘      └─────────────────────────────────────────┘
        │
        ├── proxy.ts (middleware): NO consulta BD local. Llama validarLicencia (o peek de caché síncrono).
        ├── activate: reemplaza HMAC local por validación contra AuthCenter (o solo instruye a pegar clave).
        ├── LicenseBanner: consume el resultado/caché compartido.
        └── admin/licenses: lee estado desde caché/API, SIN generar claves (emitir desde panel AuthCenter).
```

**Decisiones de diseño clave:**
- El cliente **no valida HMAC** propio ni genera claves: solo consume la API central (pública, sin JWT).
- La clave se guarda en localStorage del navegador de cada instalación (un solo punto de licencia por instalación, mismo modelo conceptual de "una activa").
- Guard de producción y banner usan **el mismo adaptador D6** (SRP: `authcenter-client.ts`).
- La tabla `aut_licenses` local y el endpoint `activate` pasan a ser **código muerto / eliminados**; `generate` y el CLI se eliminan (las claves se emiten solo desde el panel AuthCenter).

---

## 4. Fases de ejecución

### Fase 4.3-A — Base técnica en AutoStock

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| A.1 | Crear `src/lib/authcenter-client.ts`: adaptador D6 (fetch a `validate-license`, caché localStorage con `validado_en`, gracia 72 h, revalidación 24 h, tabla de acciones por estado, sin manejar secretos). Port directo de `docs/adaptador-cliente-referencia.md` | media | bajo |
| A.2 | Crear/utilizar variables de entorno: `NEXT_PUBLIC_AUTHCENTER_URL` + `NEXT_PUBLIC_AUTHCENTER_PRODUCTO` (valores públicos, sin secretos) en `.env.example` | baja | bajo |
| A.3 | Nueva ruta interna `/api/license/status` (dev+prod): expone a la UI el estado actual de `validarLicencia()` (para banner y admin sin duplicar la consulta al centro) | media | bajo |
| A.4 | `src/proxy.ts`: reemplazar la consulta a `aut_licenses` por el adaptador; redirigir a `/license` en rechazo firme o `offline_sin_gracia` | alta | medio |
| A.5 | Build + verificación local (`npm run build`) | baja | bajo |

### Fase 4.3-B — Flujo de activación y UI

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| B.1 | `license/page.tsx`: guardar clave en localStorage y validarla contra el centro (sin pasar por `/api/license/activate`) | media | medio |
| B.2 | `LicenseBanner.tsx`: leer estado del adaptador/caché (días restantes, gracia) en lugar de consultar `aut_licenses` | media | bajo |
| B.3 | `admin/licenses/page.tsx`: modo solo lectura (mostrar estado actual), **eliminar** formulario de generación | media | medio |
| B.4 | Build + verificación | baja | bajo |

### Fase 4.3-C — Retiro del licenciador local

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| C.1 | Eliminar `src/app/api/license/activate/route.ts`, `src/app/api/admin/licenses/generate/route.ts`, `scripts/generate-license.ts`, y el bloque de generación del admin | media | medio |
| C.2 | Eliminar/congelar `src/lib/license.ts` (HMAC local) y el fallback `dev_license_secret_insecure`; quitar `LICENSE_SECRET` del `.env.local` y `.env.example` de AutoStock | baja | alto (secretos) |
| C.3 | Limpiar referencias a `aut_licenses` local en código (grep) y en exclusión del proxy | media | medio |
| C.4 | **Rotación de secretos**: el `LICENSE_SECRET` actual (compartido AutoStock/MedStock, commiteado en algún punto) deja de utilizarse. Verificar en Vercel/AutoStock retirar la variable. (MedStock conserva su licenciador local por ahora → secreto NO se rota en el backend Supabase de AutoStock hasta decidir 4.4) | media | alto |
| C.5 | Script SQL de limpieza opcional: `DROP TABLE aut_licenses` en AutoStock (solo tras despliegue validado y con backup/confirmación del usuario) | baja | alto (BD viva) |

### Fase 4.3-D — Emisión y validación end-to-end

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| D.1 | Desde el **panel AuthCenter**: crear producto `AUTOSTOCK` si no existe (script `06` ya lo creó) y emitir nueva licencia (fecha inicio=instalación, duración) | baja | bajo |
| D.2 | Desplegar AutoStock en Vercel con las nuevas env vars; configurar `NEXT_PUBLIC_AUTHCENTER_URL` y `NEXT_PUBLIC_AUTHCENTER_PRODUCTO` | baja | medio |
| D.3 | Smoke test real: instalar clave → validar activa → verificar gracia offline (desconectar) → expirar/revocar desde panel central → verificar bloqueo. Resultados en `docs/resultado-fase4-autostock.md` | media | medio |
| D.4 | Reemisión de licencias activas existentes (backfill manual, una por instalación actual; según D5) | baja | medio |
| D.5 | Actualizar `config_session/memory.md` de ambos repos + commit `feat:` | baja | bajo |

---

## 5. Dependencias críticas

1. AuthCenter ya validado end-to-end (✅) y RLS corregido (✅ script 08, commit `6d2248a`).
2. Contrato `validate-license` (✅ `docs/contrato-validate-license.md`) y adaptador de referencia (✅ `docs/adaptador-cliente-referencia.md`).
3. Autorización del usuario por **fase** (A → B → C → D) antes de ejecutar cada una.
4. Checkpoint commit en **AutoStock** antes de modificar su código (regla 4).
5. No ejecutar `git push` de AutoStock sin autorización escrita explícita (regla 3).

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Las claves actuales se invalidan | Reemisión planificada (D.4), comunicada antes de activar el guard central |
| Punto único de falla (AuthCenter caído) | D6: caché con gracia 72 h + fail-closed solo en red; verificable por fase |
| `LICENSE_SECRET` compartido expuesto/commiteado | C.2/C.4: se retira del repo y de Vercel; rotación aislada por producto (D4) |
| Romper producción intermedia | Fases A→D con build y smoke por fase; licenciador local se retira al final (C) con rollback = checkpoint previo |
| MedStock usa el mismo secreto | No se rota el secreto de AutoStock en Supabase; 4.4 (MedStock) decide su port antes de rotar |

## 7. Fuera de alcance

- Migrar MedStock/Posadas en esta fase (4.4/4.5 son planes separados).
- Migrar el licenciamiento interno de Gallos al centro (decisión futura).
- CRUD de productos/usuarios desde AutoStock (todo se administra en AuthCenter).
- Backfill masivo automático: la reemisión (D.4) es manual, instalación por instalación.