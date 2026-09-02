# Plan — Fase 4.4-MedStock: Integración de MedStock con AuthCenter

**Fecha:** 02/09/2026
**Estado:** EN EJECUCIÓN — fases A, B y C completadas (build OK); pendiente D.
**Repos:** AuthCenter (emisor) ←→ MedStock (cliente, `../MedStock`)
**Autorización:** usuario confirmó que MedStock debe integrarse con el **mismo patrón y modelo que AutoStock, sin variantes** (02/09). Orden Fase 4.4: ① MedStock → ② Posadas → ③ Gallos-los-indios.

---

## 1. Objetivo

Reemplazar el licenciador **local y autocontenido** de MedStock por la validación contra el **emisor central AuthCenter** (`validate-license`), replicando EXACTAMENTE el modelo ya implementado y validado en AutoStock (Fase 4.3, `docs/resultado-fase4-autostock.md`):

- **D4:** MedStock usa su propio secreto (`LICENSE_SECRET_MEDSTOCK`) que el cliente **nunca posee**.
- **D6:** política offline del cliente (validar al iniciar + caché con gracia 72 h + revalidación 24 h + fail-closed en red).
- Eliminar el secreto compartido (`LICENSE_SECRET`) y el fallback inseguro hardcodeado (`dev_license_secret_insecure`).
- Emisión de licencias **exclusivamente** desde el panel AuthCenter.

## 2. Estado actual de MedStock (licenciamiento) — INVENTARIO REAL

| Pieza | Archivo | Modelo hoy |
|-------|---------|-----------|
| Cripto HMAC local | `src/lib/license.ts` | `verifyLicenseKey()` + `extractExpiry()` (HMAC-SHA256, formato 16 hex `XXXX-XXXX-XXXX-XXXX`, fecha YYMMDD embebida) |
| Guard global (prod) | `src/proxy.ts` (líneas 60-93) | Consulta `aut_licenses` (service_role) → redirige a `/license` (sin activa) o `/license?expired=1` (expirada). Kill switch `LICENSE_DISABLED`, fuerza `FORCE_LICENSE`, excluye `/api/admin/` |
| Activación | `src/app/api/license/activate/route.ts` | Verifica HMAC (`verifyLicenseKey`) → desactiva anteriores → extrae expiración → inserta `is_active:true` en `aut_licenses` |
| Estado | `src/app/api/license/status/route.ts` | Devuelve `{daysLeft}` consultando `aut_licenses` (service_role) |
| Generación (dev) | `src/app/api/admin/licenses/generate/route.ts` + CLI `scripts/generate-license.ts` | Genera clave HMAC local, INSERT inactiva (require JWT + rol admin) |
| Banner aviso ≤30 días | `src/components/LicenseBanner.tsx` | Consulta `aut_licenses` **client-side** (browser client) |
| Formulario activación | `src/app/license/page.tsx` | Input `XXXX-XXXX-XXXX-XXXX` (max 19) → `POST /api/license/activate` → redirect `/login` |
| Panel admin licencias (dev) | `src/app/(dashboard)/admin/licenses/page.tsx` | Ver activa + historial + generar nuevas; solo dev (`notFound()` en prod) |
| Sidebar | `src/components/Sidebar.tsx` | Link "Licencias" solo dev; badge días restantes vía `/api/license/status` |
| BD | tabla `aut_licenses` (proyecto Supabase MedStock `rrngvryilxnzffciioao`) | `VARCHAR(19)`, `expires_at DATE`, `is_active`, sin `producto_id` |
| Env vars | `.env.local` | `LICENSE_SECRET` (con fallback `dev_license_secret_insecure`), `LICENSE_DISABLED`, `FORCE_LICENSE`. **No existe `.env.example`** |

**Nada referencia a AuthCenter hoy.** Formato local 16 hex; formato central 20 hex (`XXXX-XXXX-XXXX-XXXX-XXXX`) → las claves actuales quedarán inválidas.

**D.4 (replanteado 02/09):** MedStock está en desarrollo sin clientes → las licencias viejas **se eliminan** (no se convierten). Cada instalación arrancará en blanco y se activará con una clave nueva del centro cuando corresponda.

---

## 3. Arquitectura objetivo (idéntica a AutoStock)

```
┌───────────── MedStock (Vercel) ──────────────┐      ┌──────── AuthCenter (Supabase) ────────┐
│  src/lib/authcenter-client.ts (D6)           │──HTTPS│  Edge Function validate-license        │
│    · validarInstalacion() / validarClaveIngresada() │    · HMAC (LICENSE_SECRET_MEDSTOCK)     │
│    · registrarLicenciaLocal()                │──────▶│    · consulta aut_licenses central      │
│    · caché en tabla aut_licenses local       │      │    · responde estados + días restantes  │
│    · gracia 72 h + revalidación 24 h         │  ◀────│    · sin secretos (solo anon/público)   │
└──────────────────────────────────────────────┘      └─────────────────────────────────────────┘
        │
        ├── proxy.ts (middleware): llamar validarInstalacion() (NO consulta BD directo).
        ├── activate (registro): valida contra centro → registraLicenciaLocal().
        ├── status: expone validarInstalacion() a la UI.
        ├── LicenseBanner: consume /api/license/status (no aut_licenses directo).
        └── admin/licenses: solo lectura; SIN generar (emisión desde panel AuthCenter).
```

**Decisiones de diseño (heredadas de AutoStock, sin variantes):**
- El cliente **no valida HMAC** propio ni genera claves: solo consume la API central (pública, sin JWT).
- La tabla `aut_licenses` local pasa de fuente de verdad a **caché D6** (una fila activa = instalación).
- Guard y banner usan el **mismo adaptador D6** (SRP: `authcenter-client.ts`).
- `/api/license/activate` se **conserva como registro de instalación** (opción A de AutoStock): valida contra el centro y persiste la clave en la caché local; el guard la lee de ahí.
- El generador local (CLI + API + `src/lib/license.ts`) se elimina; las claves se emiten **solo** desde el panel AuthCenter.

---

## 4. Fases de ejecución

### Fase 4.4-M-A — Base técnica en MedStock

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| A.1 | Port de `src/lib/authcenter-client.ts` desde AutoStock (adaptador D6: `validarInstalacion`, `validarClaveIngresada`, `registrarLicenciaLocal`, caché en tabla `aut_licenses`, `NEXT_PUBLIC_AUTHCENTER_URL`, `NEXT_PUBLIC_AUTHCENTER_PRODUCTO`). Adaptar `AUTHCENTER_URL`/`PRODUCTO` según env | media | bajo |
| A.2 | Crear `.env.example` con `NEXT_PUBLIC_AUTHCENTER_URL` + `NEXT_PUBLIC_AUTHCENTER_PRODUCTO` (públicos, sin secretos); el `.env.local` real lo agrega el usuario | baja | bajo |
| A.3 | `src/proxy.ts`: reemplazar el bloque LICENSE GUARD (consulta a `aut_licenses` vía service_role) por `validarInstalacion()` desde el adaptador; en rechazo firme redirigir a `/license` y a `/license?expired=1` si `expirada`. Mantener `LICENSE_DISABLED`/`FORCE_LICENSE`? Decidir en implementación: se conservan durante la transición para no romper dev | media | medio |
| A.4 | Script SQL `scripts/alter-aut_licenses-cache-d6.sql` (idempotente, igual que AutoStock): añadir `validado_en TIMESTAMPTZ`, `ultimo_estado TEXT`, `license_key VARCHAR(24)`; + DDL `scripts/create-aut_licenses.sql` actualizado | bajo | alto (BD viva — lo ejecuta el usuario) |
| A.5 | Build + verificación local (`npm run build`) | baja | bajo |

### Fase 4.4-M-B — Flujo de activación y UI

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| B.1 | `src/app/api/license/activate/route.ts`: reescribir → valida contra centro con `validarClaveIngresada()`; si `activa` persiste con `registrarLicenciaLocal()`; mensajes por estado (expirada, revocada, pendiente, etc.); 503 si no hay red | media | medio |
| B.2 | `src/app/api/license/status/route.ts`: reescribir → expone `validarInstalacion()` | media | bajo |
| B.3 | `src/components/LicenseBanner.tsx`: reescribir → consume `/api/license/status` (quitar consulta directa a `aut_licenses` y el browser client) | media | bajo |
| B.4 | `src/app/license/page.tsx`: formateo a 20 hex (5 grupos `XXXX-XXXX-XXXX-XXXX-XXXX`, max 24) | baja | bajo |
| B.5 | `src/app/(dashboard)/admin/licenses/page.tsx`: modo SOLO LECTURA (estado, días, vence, razón) vía `/api/license/status`; eliminar formulario e historial de generación | media | medio |
| B.6 | `src/components/Sidebar.tsx`: quitar el link "Licencias" (dev) y/o ajustar badge para leer estado vía status; retirar historial | media | bajo |
| B.7 | Build + verificación | baja | bajo |

### Fase 4.4-M-C — Retiro del licenciador local

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| C.1 | Eliminar `src/app/api/admin/licenses/generate/route.ts`, `scripts/generate-license.ts`, y el bloque de generación del admin | media | medio |
| C.2 | Eliminar `src/lib/license.ts` (HMAC local) y el fallback `dev_license_secret_insecure`; quitar `LICENSE_SECRET`/`LICENSE_DISABLED`/`FORCE_LICENSE` cuando ya no se usen (ver A.3); retirar de `.env.local` y `.env.example` de MedStock | baja | alto (secretos) |
| C.3 | Limpiar referencias a `aut_licenses` local en código (grep) y en exclusión del proxy | media | medio |
| C.4 | **Rotación de secretos**: `LICENSE_SECRET` compartido deja de usarse; verificar en Vercel/MedStock retirar la variable. Backend Supabase de MedStock NO rota hasta decidir (D4 elimina licencias, no migra) | media | alto |
| C.5 | Script SQL de limpieza opcional: `DROP TABLE aut_licenses` (solo tras despliegue validado, con backup/confirmación del usuario) | baja | alto (BD viva) |

### Fase 4.4-M-D — Emisión y validación end-to-end

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| D.1 | Verificar/crear producto `MEDSTOCK` en AuthCenter (`scripts/01-productos.sql` ya lo crea) y su secreto `LICENSE_SECRET_MEDSTOCK` (≥32 chars); dejarlo activo | baja | bajo |
| D.2 | Desplegar MedStock en Vercel con nuevas env vars (`NEXT_PUBLIC_AUTHCENTER_URL`, `NEXT_PUBLIC_AUTHCENTER_PRODUCTO=MEDSTOCK`) | baja | medio |
| D.3 | Smoke test real (plantilla `docs/resultado-fase4-medstock.md`): instalar clave → validar activa → gracia offline (desconectar) → revocar desde panel central → verificar bloqueo | media | medio |
| D.4 | Licencias viejas: **se eliminan** (D.4 replanteado; en desarrollo sin clientes) | baja | bajo |
| D.5 | Actualizar `config_session/memory.md` de ambos repos + commit | baja | bajo |

---

## 5. Dependencias críticas

1. AuthCenter ya validado end-to-end (✅) y RLS corregido (✅ script 08). Contrato `validate-license` (✅) y adaptador de referencia (✅).
2. Autorización del usuario por **fase** (A → B → C → D) antes de ejecutar cada una (regla 1).
3. Checkpoint commit en **MedStock** antes de modificar su código (regla 4 de MedStock).
4. No ejecutar `git push` de MedStock sin autorización escrita explícita (regla 3).

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Las claves actuales quedan inválidas | D.4 replanteado: se ELIMINAN (en desarrollo, sin clientes) |
| Punto único de falla (AuthCenter caído) | D6: caché con gracia 72 h + fail-closed solo en red |
| `LICENSE_SECRET` compartido expuesto/commiteado | C.4: se retira del repo y de Vercel; secreto por producto (D4) |
| Romper producción intermedia | Fases A→D con build y smoke por fase; rollback = checkpoint previo |
| MedStock login/feature-flags se mezclan con el guard | A.3: conservar `LICENSE_DISABLED`/`FORCE_LICENSE` en transición; mantener exclusión `/login` y `/api/admin/` |

## 7. Fuera de alcance

- Posadas y Gallos-los-indios (planes separados: `plan-fase4-posadas.md`, `plan-fase4-gallos.md`).
- CRUD de productos/usuarios desde MedStock (todo se administra en AuthCenter).
- Backfill masivo: licencias viejas se eliminan (D.4), emisión nueva desde el centro.