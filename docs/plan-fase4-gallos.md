# Plan — Fase 4.6-Gallos: Integración de Gallos-los-indios con AuthCenter

**Fecha:** 02/09/2026
**Estado:** PROPUESTO — pendiente de autorización del usuario para ejecutar (regla 1 de `config_session/rules.md`)
**Repos:** AuthCenter (emisor) ←→ Gallos-los-indios (cliente, `../Gallos-los-indios`)
**Autorización:** usuario confirmó que Gallos debe adoptar el **mismo patrón y comportamiento exacto que AutoStock y MedStock** (02/09): una única plataforma central de licencias (AuthCenter) y todas las apps clientes comportándose idéntico (validación contra `validate-license`, adaptador D6, retiro del licenciador local, emisión exclusiva desde el panel AuthCenter). Orden Fase 4.4 (cambiado 02/09): ① MedStock ✅ → ② Gallos-los-indios → ③ Posadas.

---

## 1. Objetivo

Reemplazar el licenciador **local/autocontenido** de Gallos por la validación contra el **emisor central AuthCenter** (`validate-license`), replicando EXACTAMENTE el modelo implementado y validado en AutoStock (F4.3) y MedStock (F4.4-M):

- **D4:** Gallos usa su propio secreto (`LICENSE_SECRET_GALLOS`) que el cliente **nunca posee**.
- **D6:** política offline del cliente (validar al iniciar + caché con gracia 72 h + revalidación 24 h + fail-closed en red).
- Retirar el emisor local (Edge Function `create-license` de Gallos) y el helper HMAC (`_shared/license-keys.ts` interno).
- Emisión de licencias **exclusivamente** desde el panel AuthCenter.
- Comportamiento final IDÉNTICO al ya probado en AutoStock/MedStock, independiente del stack del cliente.

> **Aclaración de alcance:** AuthCenter NO toca el código de `../Gallos-los-indios`. El refactor del licenciador interno de Gallos se hace **desde el propio repo Gallos**, que es el que adopta AuthCenter como centro. Esto es coherente con el AGENTS.md (no se toca el módulo `/admin/licencias` interno *desde AuthCenter*) y con la decisión del usuario (que Gallos se comporte como MedStock).

---

## 2. Estado actual de Gallos (licenciamiento) — INVENTARIO REAL

> Resultado del sondeo del 02/09. CLAVE: **Gallos es Vanilla JS + Vite 5 multi-página, NO Next.js.** Diferente de AutoStock/MedStock. No tiene guard de licencia en runtime (el sitio público no se bloquea); la licencia existe como emisor/validador + CRUD admin.

| Pieza | Archivo | Modelo hoy |
|-------|---------|-----------|
| Emisor HMAC local | `supabase/functions/create-license/index.ts` (+ `_shared/license-keys.ts`) | Edge Function Deno que genera clave + inserta en `aut_licenses` (secreto `LICENSE_SECRET` en Supabase secrets) |
| Validador interno | `supabase/functions/validate-license/index.ts` | API pública de Gallos para apps externas que consumen ESTE centro (NO AuthCenter) |
| Helper crypto | `supabase/functions/_shared/license-keys.ts` | HMAC-SHA256, formato 20 hex `XXXX-XXXX-XXXX-XXXX-XXXX`, timing-safe |
| Tabla BD | `public.aut_licenses` (BD Gallos `xajoluulcetkioemrnsc`) | `license_key varchar(24) UNIQUE`, `expires_at`, `is_active`, `fecha_inicio`, RLS rol admin (vía `user_metadata`) |
| Emisión admin | `src/lib/api.js` (`API.licencias.generar`) → `create-license` | Genera vía Edge Function siempre (secreto no sale del servidor) |
| CRUD admin | `pages/admin/licencias.html` + `src/admin/licencias.js` | Listar/generar/editar/revocar/eliminar/copiar/CSV |
| Guard | Ninguno en runtime | No hay middleware/proxy; el sitio público no bloquea por licencia. Solo guard de rol (`isAdmin()`) en admin |
| Env vars | `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Secrets: `LICENSE_SECRET` | No hay `NEXT_PUBLIC_AUTHCENTER_*` ni `.env.example` aún |

**Formato de clave Gallos es IDÉNTICO al de AuthCenter** (20 hex, prefijo fecha+serial+HMAC8). Las claves emitidas por el centro para producto `GALLOS` serán directamente compatibles con el formato que Gallos ya maneja.

**D.4 (aplicado):** licencias viejas de Gallos **se eliminan** (en desarrollo, sin clientes reales). Cada instalación arrancará en blanco con una clave nueva del centro cuando corresponda.

---

## 3. Arquitectura objetivo (comportamiento idéntico a AutoStock/MedStock)

```
┌────────── Gallos (static/Vercel) ─────────┐      ┌──────── AuthCenter (Supabase) ────────┐
│  src/lib/authcenter-client.js (D6)        │──HTTPS│  Edge Function validate-license        │
│    · validarInstalacion()                 │       │    · HMAC (LICENSE_SECRET_GALLOS)      │
│    · validarClaveIngresada()              │──────▶│    · consulta aut_licenses central      │
│    · caché local (D6: gracia 72h,         │       │    · responde estados + días restantes │
│      revalidación 24h)                    │  ◀────│    · pública (anon), sin secretos      │
└───────────────────────────────────────────┘      └─────────────────────────────────────────┘
        │
        ├── Banner de estado (≤30 días) y aviso de expiración.
        ├── Bloqueo/aviso en rutas protegidas (panel admin) si no hay licencia activa.
        └── /admin/licencias → SOLO LECTURA (emisión desde el panel AuthCenter).
```

**Decisiones de diseño (heredadas de AutoStock/MedStock, sin variantes de comportamiento):**
- El cliente **no valida HMAC propio** ni genera claves: solo consume la API central (pública).
- **Caché D6** para uso offline: se persiste la última validación (clave activa + `validado_en` + `ultimo_estado`); gracia 72 h + revalidación 24 h + fail-closed.
- Como Gallos es **estático (Vite)**, la caché D6 vive en el navegador (`localStorage`) en lugar de una tabla BD server-side (a diferencia de AutoStock/MedStock, que usaban tabla `aut_licenses` local vía service_role). Esto NO cambia el comportamiento observable: validación + gracia + revalidación idénticas.
- El **módulo admin interno se reforma a SOLO LECTURA**: no más generación/edición desde Gallos; la emisión pasa al panel AuthCenter.
- Se **retira** el emisor local: Edge Function `create-license` de Gallos y el helper `_shared/license-keys.ts` interno (ya no se usan; el centro emite).

**Enforcement en estático (decisión de diseño):** al no existir middleware de servidor, la validación se ejecuta en el cliente:
- Al **inicio de la app** (público): se marca si hay licencia activa o no, y se muestran avisos; las páginas públicas siguen accesibles (comportamiento actual de Gallos).
- En **rutas que requieren licencia** (panel admin /admin/*): si no hay licencia activa / está en gracia, se redirige a una vista de activación (`/admin/licencia` o similar) o se muestra banner bloqueante (equivalente al `/license` de AutoStock/MedStock).

---

## 4. Fases de ejecución

### Fase 4.6-G-A — Base técnica en Gallos

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| A.1 | Crear `src/lib/authcenter-client.js` — adaptador D6 (port a JS vanilla de `authcenter-client.ts` de MedStock): `validarInstalacion()`, `validarClaveIngresada()`, `registrarLicenciaLocal()`; caché en `localStorage`; `VITE_AUTHCENTER_URL` + `VITE_AUTHCENTER_PRODUCTO=GALLOS`; gracia 72 h + revalidación 24 h + fail-closed | media | bajo |
| A.2 | Crear `.env.example` con `VITE_AUTHCENTER_URL` + `VITE_AUTHCENTER_PRODUCTO` (públicos, sin secretos); el `.env` real lo actualiza el usuario | baja | bajo |
| A.3 | Punto de enforcement en cliente: al arrancar (main) se invoca `validarInstalacion()` y se guarda estado global; proteger rutas admin (banner/bloqueo si no hay licencia activa) | media | medio |
| A.4 | Build + verificación (`npm run build`) | baja | bajo |

### Fase 4.6-G-B — Flujo de activación y UI

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| B.1 | Vista de activación (`/admin/licencia` o similar): input 20 hex `XXXX-XXXX-XXXX-XXXX-XXXX`, valida con `validarClaveIngresada()` (remoto), persistir con `registrarLicenciaLocal()`; mensajes por estado (expirada, revocada, pendiente, programada, firma_invalida) y 503 si sin red | media | medio |
| B.2 | Banner de estado de licencia: consume el estado global/D6, muestra "expira en N días" (≤30) / "activada" | media | bajo |
| B.3 | `src/admin/licencias.js`: reformar a **SOLO LECTURA** (ver activa/vence/días vía D6; quitar generar/editar/eliminar) | media | medio |
| B.4 | Build + verificación | baja | bajo |

### Fase 4.6-G-C — Retiro del licenciador local

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| C.1 | Eliminar Edge Function `create-license` de Gallos (`supabase/functions/create-license/`) | baja | alto (BD viva — lo ejecuta el usuario) |
| C.2 | Eliminar helper `supabase/functions/_shared/license-keys.ts` interno (si `validate-license` de Gallos ya no se usa para otra cosa, también) | media | medio |
| C.3 | Quitar secreto `LICENSE_SECRET` de Supabase Gallos (rotación: deja de usarse) | baja | alto (secretos) |
| C.4 | Limpiar referencias a `aut_licenses` local y a la emisión en `src/lib/api.js`/`src/admin/`; eliminar generación | media | medio |
| C.5 | Script SQL de limpieza opcional: `DROP TABLE aut_licenses` (solo tras despliegue validado, con backup/confirmación del usuario) | baja | alto (BD viva) |

### Fase 4.6-G-D — Emisión y validación end-to-end

| # | Tarea | Complejidad | Riesgo |
|---|-------|-------------|--------|
| D.1 | Verificar/crear producto `GALLOSLOSINDIOS` en AuthCenter (ya existe, `06-galloslosindios-producto.sql`) y su secreto `LICENSE_SECRET_GALLOS` (≥32 chars); dejarlo activo | baja | bajo |
| D.2 | Desplegar Gallos en Vercel con nuevas env vars (`VITE_AUTHCENTER_URL`, `VITE_AUTHCENTER_PRODUCTO=GALLOS`) | baja | medio |
| D.3 | Smoke test real (plantilla `docs/resultado-fase4-gallos.md`): activar clave → validar activa → gracia offline → revocar desde panel central → bloquear | media | medio |
| D.4 | Licencias viejas: **se eliminan** (D.4 replanteado; en desarrollo sin clientes) | baja | bajo |
| D.5 | Actualizar `config_session/memory.md` de ambos repos + commit | baja | bajo |

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Stack distinto (Vite estático vs Next) rompe el patrón | El comportamiento se mantiene idéntico (D6, validate-license, emisión desde el centro). Solo cambia el medio de caché (localStorage vs tabla BD) y el enforcement (cliente vs middleware). Sin variantes de comportamiento. |
| Caché por instalación en localStorage vs múltiples usuarios | Acceptable para el patrón: una licencia por navegador/instalación; se puede endurecer con un fingerprint de instalación si hace falta. |
| Secreto `LICENSE_SECRET` viejo queda expuesto | C.3: se retira de Supabase Gallos. |
| Rotación de secretos invalida claves emitidas | Se re-emitirá desde el panel central cuando aplique (D.4: licencias viejas se eliminan). |
| Enforcement en cliente es eludible | Igual que AutoStock/MedStock (la UI no es la frontera de seguridad; la firma la valida el centro). El centro es la fuente de verdad. |
| Módulo `/admin/licencias` interno "no se toca desde AuthCenter" | El refactor se hace desde el repo Gallos (no desde AuthCenter). AuthCenter solo valida/emite desde su panel. |

## 6. Dependencias críticas

1. AuthCenter validado end-to-end (✅ AutoStock, ✅ MedStock). Contrato `validate-license` (✅) y adaptador de referencia (✅).
2. Autorización del usuario por **fase** (A → B → C → D) (regla 1).
3. Checkpoint commit en **Gallos** antes de modificar su código (regla 4).
4. No ejecutar `git push` de Gallos sin autorización escrita explícita (regla 3).

## 7. Fuera de alcance

- Posadas (plan separado `docs/plan-fase4-posadas.md`).
- Tocar el módulo editorial/CHATE del sitio Gallos (no relacionado con licencias).
- Backfill masivo: licencias viejas se eliminan (D.4), emisión nueva desde el centro.