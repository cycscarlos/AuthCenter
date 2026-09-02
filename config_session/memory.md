# Contexto de Sesión — AuthCenter

## Qué es

Emisor central de licencias agnóstico y multi-producto (AutoStock, MedStock, Posadas y futuros). Proyecto NUEVO e independiente; repo hermano de Gallos-los-indios (`../Gallos-los-indios`). El módulo de licencias interno de Gallos NO se toca desde aquí.

## Stack decidido

- **Panel:** Vanilla JS (ES modules) + Vite multi-página (`index.html`, `panel/licencias.html`, `panel/productos.html`).
- **Backend:** proyecto Supabase DEDICADO nuevo (D1) + Edge Functions Deno.
- **Deploy panel:** Vercel aparte (D2), configurado con `vercel.json` y cabeceras CSP.

## Decisiones confirmadas por el usuario (25/08)

- D1 Supabase dedicado — **CREADO 25/08 en la org alchemy** (REF `ijvevdplnovkewxifpmf`).
- D1b Repo GitHub "AuthCenter" creado.
- D2 Panel standalone en Vercel aparte.
- D3 Tabla `productos` + `producto_id` FK; alta de productos por SQL.
- D4 Un secreto por producto (`LICENSE_SECRET_AUTOSTOCK`, etc.), sin fallback, ≥32 chars.
- D5 Backfill de licencias históricas OPCIONAL.
- D6 Offline cliente: validar al iniciar + gracia 72 h + revalidación 24 h.
- D7 Admins vía tabla `usuarios` del centro (patrón Gallos).

## Plan maestro y guías

- `docs/plan-emisor-central-licencias.md` — Plan maestro Fases 0–5.
- `docs/guia-paso-a-paso-usuario.md` — Guía completa de validación y deploy.
- `docs/tests-fase31-curls.md` — Comandos PowerShell E2E.

## Estado actual

### Fase 0 + 1 + 2 + 2.5 COMPLETADAS

- BD (productos, usuarios, aut_licenses, rate_limits) y RLS activos.
- Edge Functions (`create-license`, `validate-license`) desplegadas en `https://ijvevdplnovkewxifpmf.supabase.co`.
- Secretos de AUTOSTOCK, MEDSTOCK, POSADAS configurados.

### Fase 3 — Panel Admin Standalone (COMPLETADA 28/08)

- **Scaffold Vite multi-página:** Creado y estructurado con `index.html` (login), `/panel/licencias.html` y `/panel/productos.html`.
- **Diseño CSS:** Sistema de diseño oscuro con acentos dorados ámbar, componentes responsivos, badges de estado, stat-cards y modales.
- **Capa de datos y Auth:** `src/lib/` (`supabase.js`, `auth.js`, `api.js`, `escape.js`).
- **Funcionalidades:**
  - Login de admin verificado con Supabase Auth.
  - Tabla de licencias con búsqueda y filtros por producto.
  - Modales para crear/editar licencias con cálculo de fecha de expiración.
  - Revocación/reactivación y eliminación de licencias.
  - Copia de claves al portapapeles con 1-clic.
  - Exportación a CSV con formato BOM compatible con Excel.
  - Switch de activación/desactivación de productos.
- **Corrección Auth Admin:** Script `07B-fix-admin-auth.sql` ejecutado exitosamente para activar `email_confirmed_at` y rol `admin`.
- **Corrección Timeout 504 en `create-license`:** Se eliminó la llamada interna HTTP a `/auth/v1/user` dentro de la Edge Function, reemplazándola por decodificación local JWT + consulta a `public.usuarios` en Postgres. La emisión responde en <300ms.
- **Corrección Toast Frontend:** `src/pages/licencias.js` ajustado para extraer `res.licencia.license_key`.
- **Verificación de build:** `npm run build` compila 100% limpio en `dist/`.
- **Verificación End-to-End:** El usuario creó exitosamente licencias desde el panel web.

### Pendientes Próximos

1. ~~**Gallos-los-indios (4to producto):**~~ ✅ COMPLETADO.
2. ~~**Deploy en Vercel:**~~ ✅ COMPLETADO 01/09. Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) configuradas y redeploy OK. App accesible desde Vercel.
3. ~~**Advertencia Supabase Security Advisor — RLS usa `user_metadata`:**~~ ✅ RESUELTO 01/09. Se ejecutó `00-backup-snapshot.sql` (backup) + `scripts/08-fix-rls-rol.sql` en Dashboard AuthCenter. Políticas `*_jwt` de `productos`, `aut_licenses` y `usuarios` ahora consultan la tabla `public.usuarios` vía funciones `SECURITY DEFINER` (`es_admin()`, `es_admin_o_soporte()`) evitando recursión y eliminando dependencia de `user_metadata` (fuente de verdad alineada con D7 y Edge Functions). Alerta Security Advisor resuelta.
4. **Integración Clientes (Fase 4):** Conectar clientes (AutoStock primero).

### Fase 4 — Integral Clientes (EN CURSO)

- **4.1 Contrato `validate-license` ✅ 01/09:** `docs/contrato-validate-license.md` — request/response, 10 estados, códigos HTTP (429/405/503/500), rate limit 30/min, política de gracia offline D6.
- **4.2 Adaptador cliente de referencia ✅ 01/09:** `docs/adaptador-cliente-referencia.md` — implementación JS (browser/Node) con caché + gracia 72 h + revalidación 24 h + tabla de acciones por estado.
- **4.3 AutoStock ✅ COMPLETADA 01/09.** Plan `docs/plan-fase4-autostock.md` autorizado. **Fase A** (checkpoint `924a71b`): adaptador D6 `src/lib/authcenter-client.ts`, proxy sin BD local, `.env.example`, script ALTER caché. Build OK. **Fase B** (opción A — endpoint de registro): `api/license/activate` reescrito contra centro, `api/license/status`, LicenseBanner y admin solo lectura, `/license` con 20 hex. ALTER SQL ejecutado. **Fase C** (`67413c7`): retirado licenciador local (generador admin, CLI, `src/lib/license.ts`); `tsconfig` excluye `docs/`. **Fase D COMPLETADA 01/09** (checkpoint `69c1252`): plantilla `docs/resultado-fase4-autostock.md` cerrada conforme; licencia demo "Meteoro" (2 días) validada end-to-end a la primera.

### Fase 4 — Decisión del usuario (01/09) sobre D.4 y Fase 4.4

- **1) D.4 REPLANTEADO:** AutoStock, MedStock, Posadas y Gallos-los-indios están **en desarrollo, sin clientes reales**. Las licencias viejas **se ELIMINAN, no se convierten** (nada de backfill/reemisión). Cada producto arranca en blanco y se activa con claves nuevas del centro cuando corresponda.
- **2) Fase 4.4 ampliada:** integrar al nuevo sistema AuthCenter **MedStock, Posadas y Gallos-los-indios** (los tres).
- **3) Orden de trabajo:** ① MedStock → ② **Gallos-los-indios** → ③ Posadas. (Cambiado 02/09: Gallos antes que Posadas porque comparte stack Next.js+Supabase+Vercel con AutoStock/MedStock; Posadas tiene otro stack: MySQL + AlwaysData.net, fuera de Supabase/Vercel — caso especial y más complejo).

### Fase 4 — Orden permanente (guardada 02/09) para las próximas integraciones

- **Grado de integración (obligatorio, igual que AutoStock):** ① adaptador D6 (caché + gracia 72 h + revalidación 24 h) contra `validate-license`, ② **retiro del licenciador local** (HMAC local, generador admin, CLI, tablas/claves viejas), ③ **emisión exclusiva desde el panel AuthCenter** (sin generación local).
- **Cada aplicación pendiente (MedStock, Posadas, Gallos-los-indios) debe tener su propio plan de implementación** en `docs/`, similar a `docs/plan-fase4-autostock.md` (estructura fases A→D):
  - `docs/plan-fase4-medstock.md` ✅ (completado)
  - `docs/plan-fase4-gallos.md` ✅ (en ejecución — Fase A y B completadas 02/09)
  - `docs/plan-fase4-posadas.md`
- **Orden de ejecución:** ① MedStock ✅ → ② Gallos-los-indios → ③ Posadas.

### Fase 4.4-M — MedStock (Fases A, B, C y D COMPLETADAS 02/09)

- Plan autorizado `docs/plan-fase4-medstock.md` (commit `4344bfc`), mismo patrón/modelo que AutoStock sin variantes. Estado: COMPLETADO.
- **Fase A** (`59a375e` en MedStock): adaptador D6 `src/lib/authcenter-client.ts` (producto MEDSTOCK) + guard `src/proxy.ts` vía `validarInstalacion()` + `.env.example` + `scripts/alter-aut_licenses-cache-d6.sql` (ADD `validado_en TIMESTAMPTZ`, `ultimo_estado TEXT`, `license_key VARCHAR(24)`). Build OK.
- **Fase B** (`3f326ca` en MedStock): `status/route.ts`→`validarInstalacion`, `activate/route.ts`→`validarClaveIngresada()`+`registrarLicenciaLocal()`, `LicenseBanner` vía status, `license/page` 20 hex, `admin/licenses` SOLO LECTURA, `Sidebar` `dias_restantes`. Build OK.
- **Fase C** (`07a20b0` en MedStock): eliminados `api/admin/licenses/generate`, `scripts/generate-license.ts`, `src/lib/license.ts` (HMAC local); retirado `LICENSE_SECRET`/`dev_license_secret_insecure` de `src/`; `tsconfig` excluye `docs/`. Build OK.
- **Fase D (completada 02/09):** producto MEDSTOCK ✓ + secreto `LICENSE_SECRET_MEDSTOCK` ✓ + deploy Vercel ✓ + smoke test end-to-end ✓ (plantilla `docs/resultado-fase4-medstock.md`). Licencia tipo "prueba", inicio 02-09-2026, duración 1 día, activada con éxito en MedStock.
- **Incidente resuelto (D.3):** dos claves MEDSTOCK emitidas previamente devolvían `firma_invalida` en `validate-license` (secreto `LICENSE_SECRET_MEDSTOCK` distinto del usado al firmar / rotación puntual). Solución: **re-emitir** desde el panel AuthCenter. No se tocó código de AuthCenter. Deploy de MedStock verificado (ruta `admin/licenses/generate` ya no existe → 307 proxy guard; build limpio con `VERCEL_FORCE_NO_BUILD_CACHE=1`).
- **D.4:** licencias viejas de MedStock **se eliminan** (en desarrollo, sin clientes).

### Fase 4.4-G — Gallos-los-indios (Fases A y B COMPLETADAS 02/09)

- Plan autorizado `docs/plan-fase4-gallos.md` (commit `4e05b7e`). **Gallos es Vanilla JS + Vite estático (NO Next.js)** — corrección a la memoria que lo asumía Next. Mismo comportamiento que AutoStock/MedStock, con caché D6 en `localStorage` (no tabla BD server-side) y enforcement en cliente (no middleware).
- **Fase A** (`3b39d4f` en Gallos): `src/lib/authcenter-client.js` (adaptador D6 vanilla: `validarInstalacion`, `validarClaveIngresada`, `registrarLicenciaLocal`, `requireLicencia`) + `.env.example`. Build OK.
- **Fase B** (`7698d3c` en Gallos): vista de activación `pages/admin/licencia.html` + `src/admin/licencia.js` (input 20 hex, validación remota, registro + caja de estado); banner `src/admin/shared/licence-banner.js` integrado en `admin-shell.js` (común a todas las páginas admin); `/admin/licencias` reformado a SOLO LECTURA (estado de la instalación vía D6, sin CRUD). CSS nuevo en `public/css/admin.css`. Build OK. Los enlaces de activación apuntan a `/pages/admin/licencia.html` (ruta Vite real, NO `/admin/...`).
- **Pendiente:** Fase C (retirar emisor local `create-license` de Gallos + `_shared/license-keys.ts` + secreto `LICENSE_SECRET`) y Fase D (producto `GALLOS` ya creado + deploy Vercel + smoke test `docs/resultado-fase4-gallos.md`). `requireLicencia()` aún no enchufado duro a todas las rutas admin (solo banner informativo).
- **D.4:** licencias viejas de Gallos **se eliminan** (en desarrollo, sin clientes).

### Nota sesión 01/09 (Vercel)

- Al primer ingreso al dashboard desde el dominio Vercel apareció un 401 en la carga de licencias (spinner infinito). Se resolvió con un refresh: carrera de inicialización de sesión (localStorage de sesión es por origen; `localhost` ≠ dominio Vercel). La sesión quedó persistida tras el primer GET → bug latente de UX conocido, no de seguridad/RLS.

---

## Convenciones

- Todo en español; prefijos commit: `fix:`, `feat:`, `checkpoint:`, `chore:`.
- `docs/` y `config_session/` SÍ se versionan en este repo.
- `.env` gitignoreado: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Checkpoints

- **checkpoint `2d7b125`** (01/09): "Actualización variables de entorno en vercel" — memoria actualizada (estado real: Gallos completado, env vars Vercel OK) + guía `docs/vercel-env-vars.md`. Punto base antes del fix de RLS (script 08).
- **checkpoint fin de Fase 2.5/3 (`6d2248a`):** Fix RLS aplicado (`scripts/08-fix-rls-rol.sql`) + memoria. Alerta Security Advisor resuelta.
- **checkpoint tareas 4.1/4.2 (`668a370`):** Contrato `validate-license` + adaptador cliente referencia en `docs/`. Fase 4 en curso.
- **Fase A AutoStock (`1d21fdd` en AutoStock):** adaptador D6 + proxy + SQL caché. Plan `05bfeb3` en este repo.
- **Fase B AutoStock (`ec7c335` en AutoStock):** activación y estado contra centro.
- **Fase C AutoStock (`67413c7` en AutoStock):** retirado licenciador local (generador admin, CLI, HMAC local). `tsconfig` excluye `docs/`.
- **checkpoint Fase D (`69c1252`):** plantilla `docs/resultado-fase4-autostock.md`.

> **Reemisión D.4** pendiente cuando aplique (instalaciones existentes de AutoStock).

> **ACTUALIZACIÓN 01/09:** D.4 replanteado — NO reemisión/conversión. Licencias viejas de todos los productos **se eliminan** (productos en desarrollo, sin clientes). Orden Fase 4.4: MedStock → Posadas → Gallos-los-indios.

> **PROGRESO FASE 4.4-M (02/09):** MedStock **COMPLETADO** end-to-end. Fases A–D terminadas (`4344bfc` plan; `59a375e`/`3f326ca`/`07a20b0` en MedStock; cierre `caca1b2` en este repo). Incidente D.3 resuelto por re-emisión (secreto). (Detalle en la sección "Fase 4.4-M" de este archivo).

> **PLAN GALLOS (02/09):** orden cambiado — Gallos antes que Posadas. Plan `docs/plan-fase4-gallos.md` redactado (estructura A→D, mismo comportamiento que AutoStock/MedStock; Gallos es Vite/vanilla, no Next — caché D6 vía localStorage + enforcement en cliente). Pendiente de autorización por fase para ejecutar.

---

## Referencia rápida Fase 4.3-D (cerrada)

1. **D.1 Emitir licencia AUTOSTOCK** ✅ — producto AUTOSTOCK, tipo demo, duración 2 días, inicio 01-09-2026, cliente "Meteoro". Validada a la primera.
2. **D.2 Env vars en Vercel (AutoStock)** ✅ — `NEXT_PUBLIC_AUTHCENTER_URL=https://ijvevdplnovkewxifpmf.supabase.co/functions/v1/validate-license` (confirmado por el usuario en Vercel) y `NEXT_PUBLIC_AUTHCENTER_PRODUCTO=AUTOSTOCK`.
3. **D.3 Smoke test** ✅ — `docs/resultado-fase4-autostock.md` cerrado por conformidad: instalación OK a la primera, banner "expira en 2 días" correcto, panel admin en dev OK. Prueba 3 (gracia offline) no ejecutada.
4. **D.4 Reemisión masiva** — PENDIENTE cuando aplique (instalaciones existentes).
5. **D.5 Memoria + commit** — este commit.
