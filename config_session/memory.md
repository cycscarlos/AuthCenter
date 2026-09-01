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
- **4.3 AutoStock:** EN CURSO 01/09. Plan `docs/plan-fase4-autostock.md` autorizado (migración completa + reemisión + acceso al repo). **Fase A implementada** en AutoStock (checkpoint `924a71b`): adaptador D6 `src/lib/authcenter-client.ts`, proxy sin BD local, `.env.example`, script ALTER caché. Build OK. **Fase B implementada** (diseño opción A — endpoint de registro): `api/license/activate` reescrito valida contra centro, `api/license/status` nuevo, LicenseBanner y admin en solo lectura, página `/license` con formato 20 hex. ALTER SQL ejecutado por el usuario. Pendientes: Fase C (retirar generador local) autorizar, deploy Vercel con env vars, Fase D (reemisión).

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
