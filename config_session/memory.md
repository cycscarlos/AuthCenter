# Contexto de Sesión — AuthCenter

## Qué es

Emisor central de licencias agnóstico y multi-producto (AutoStock, MedStock, Posadas y futuros). Proyecto NUEVO e independiente; repo hermano de Gallos-los-indios (`../Gallos-los-indios`). El módulo de licencias interno de Gallos NO se toca desde aquí.

## Stack decidido

- **Panel:** Vanilla JS (ES modules) + Vite multi-página — scaffold pendiente (Fase 3 del plan).
- **Backend:** proyecto Supabase DEDICADO nuevo (D1) + Edge Functions Deno.
- **Deploy panel:** Vercel aparte (D2).
- Hoy NO existe package.json ni build; verificación = revisión directa hasta el scaffold.

## Decisiones confirmadas por el usuario (25/08)

- D1 Supabase dedicado — **CREADO 25/08 en la org alchemy** (junto a AutoStock; Supabase limitó Free a 2 proyectos/org y cycs quedó descartada). URL/anon key en poder del usuario.
- D1b Repo GitHub "AuthCenter" creado; remote aún sin linkear/pushear localmente.
- D2 Panel standalone en Vercel aparte.
- D3 Tabla `productos` + `producto_id` FK; alta de productos por SQL.
- D4 Un secreto por producto (`LICENSE_SECRET_AUTOSTOCK`, etc.), sin fallback, ≥32 chars.
- D5 Backfill de licencias históricas OPCIONAL.
- D6 Offline cliente: validar al iniciar + gracia 72 h + revalidación 24 h.
- D7 Admins vía tabla `usuarios` del centro (patrón Gallos).

## Plan maestro

`docs/plan-emisor-central-licencias.md` — Fases 0–5 con complejidad/riesgo por tarea.

## Estado actual

### Fase 0+1 COMPLETADA
- Scripts SQL ejecutados en AuthCenter sin novedad: 01 productos+seed, 02 usuarios admins, 03 aut_licenses con producto_id FK, 04 rate limit.

### Fase 2 CÓDIGO COMPLETO (`c51efc9`, checkpoint previo `cdf97bd`)
- Edge Functions multi-producto en `supabase/functions/`. `_shared/license-keys.ts` portado con `getLicenseSecret(producto)` → lee `LICENSE_SECRET_<CODIGO>` (sin fallback, ≥32 chars, regex PRODUCTO_RE). `_shared/distributed-rate-limit.ts` port exacto; `rate-limit.ts` y `sanitize.ts` slim (solo lo usado). `create-license`: JWT → admin vía tabla usuarios → producto existe+activo → secreto del producto → reintento 23505 → inserta con producto_id. `validate-license`: rechazo barato→caro (formato clave → formato producto → producto BD → secreto → HMAC → licencia verificando producto_id); estados nuevos `producto_invalido`/`producto_inactivo`; fail-closed 503. `config.toml`: 2 funciones verify_jwt=false. esbuild parse OK (6 TS).

### Fase 2.5 — Infraestructura de deploy (26/08)
- **Admin creado:**
  - Auth user: UUID `d830e483-1a13-490a-a2b7-018f75640fa8`, email `alchemy.zcoder@gmail.com`, confirmado.
  - Fila en `public.usuarios`: rol `admin`, activo `true`.
  - Metadata JWT actualizada: `{"email_verified": true, "rol": "admin"}` vía `scripts/05-update-meta-primer-admin.sql`.
- **Supabase CLI:** instalada globalmente vía `npm install -g supabase` → v2.115.0 en PATH (`%APPDATA%\npm`).
- **Proyecto linkeado:** `supabase link --project-ref ijvevdplnovkewxifpmf` (AuthCenter, org alchemy). Nota: hubo que limpiar directorio `.temp` ReadOnly antes de linkear.
- **REF de AuthCenter:** `ijvevdplnovkewxifpmf` (org `aeqlcnsjliwequcshamf`).

### Fase 2.5 COMPLETADA — Deploy y tests (26/08)
- **Secretos creados** via Dashboard UI (CLI dio 403 por permisos de org; el usuario es Owner pero el token CLI no los reflejaba; se resolvió con re-login + Dashboard como workaround):
  - `LICENSE_SECRET_AUTOSTOCK` ✓
  - `LICENSE_SECRET_MEDSTOCK` ✓
  - `LICENSE_SECRET_POSADAS` ✓
- **Edge Functions desplegadas** vía CLI tras re-login:
  - `create-license` → `https://ijvevdplnovkewxifpmf.supabase.co/functions/v1/create-license`
  - `validate-license` → `https://ijvevdplnovkewxifpmf.supabase.co/functions/v1/validate-license`
- **Smoke tests validate-license** (todos OK):
  - clave malformada → `formato_invalido` ✅
  - producto fantasma → `producto_invalido` ✅
  - firma falsa + AUTOSTOCK → `firma_invalida` ✅
- **Probe RLS** (anon sobre `aut_licenses`): `401 permission denied` ✅

### Pendiente (Fase 2 del proyecto)
1. **Test create-license** con JWT de admin real (generar licencia para un producto y validarla).
2. **Gallos-los-indios** como 4to producto: INSERT en `productos` + 4to secreto (pendiente del usuario).
3. **Pendiente externo:** issue en AutoStock — tabla mal creada (aut_licenses, accidente 25/08). Script de limpieza en repo de Gallos (`scripts/AUTOSTOCK-limpieza-aut_licenses.sql`); ejecutar en proyecto AUTOSTOCK antes de integrar ese cliente.

> Plan de la Fase 2 documentado en `docs/plan-fase3-validacion-cierre.md`.

## Convenciones

- Todo en español; prefijos commit: `fix:`, `feat:`, `checkpoint:`, `chore:`.
- `docs/` y `config_session/` SÍ se versionan en este repo (decisión bootstrap: no repetir la pérdida de historial de planes de Gallos).
- `.env` gitignoreado: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` cuando exista el panel.
- Actualizar este `memory.md` al final de cada sesión.

## Último Checkpoint

- **(pendiente commit)** — checkpoint: fin de Fase 1 (infraestructura completa: BD + admin + CLI + secretos + deploy Edge Functions + smoke tests validate-license + RLS verificado + plan Fase 2 en docs/).
