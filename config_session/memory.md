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

- **Fase 0+1 COMPLETADA:** scripts SQL en `scripts/` (00 backup defensivo, 01 productos+seed, 02 usuarios admins, 03 aut_licenses con producto_id FK, 04 rate limit). Trasladados byte-idénticos desde Gallos (origen: commit `f307a1c` del repo de Gallos).
- **Fase 2 CÓDIGO COMPLETO (`c51efc9`, checkpoint previo `cdf97bd`):** Edge Functions multi-producto en `supabase/functions/`. `_shared/license-keys.ts` portado con `getLicenseSecret(producto)` → lee `LICENSE_SECRET_<CODIGO>` (sin fallback, ≥32 chars, regex PRODUCTO_RE). `_shared/distributed-rate-limit.ts` port exacto; `rate-limit.ts` y `sanitize.ts` slim (solo lo usado). `create-license`: JWT → admin vía tabla usuarios → producto existe+activo → secreto del producto → reintento 23505 → inserta con producto_id. `validate-license`: rechazo barato→caro (formato clave → formato producto → producto BD → secreto → HMAC → licencia verificando producto_id); estados nuevos `producto_invalido`/`producto_inactivo`; fail-closed 503. `config.toml`: 2 funciones verify_jwt=false. esbuild parse OK (6 TS).
- **PENDIENTE USUARIO (orden crítico):**
  1. SQL Editor VERIFICANDO proyecto = AuthCenter (org alchemy) → ejecutar 01 → 02 → 03 → 04 (00 opcional vacía), corriendo verificaciones comentadas tras cada uno.
  2. Alta manual primer admin tras 02 (Authentication → INSERT con UUID).
  3. Terminal del usuario: `supabase link --project-ref <REF>` → `supabase secrets set LICENSE_SECRET_AUTOSTOCK=<64hex> LICENSE_SECRET_MEDSTOCK=<64hex> LICENSE_SECRET_POSADAS=<64hex>` → deploy de las 2 funciones.
  4. Smoke test validate-license: clave malformada → `formato_invalido`; clave 20-hex firma falsa + AUTOSTOCK → `firma_invalida`; producto fantasma → `producto_invalido`.
  5. Probe REST: anon debe recibir 403 permission denied (= RLS activo día 1).
- **Pendiente externo:** issue en AutoStock — una tabla mal creada (aut_licenses, accidente del 25/08). Script de limpieza creado en el repo de Gallos (`scripts/AUTOSTOCK-limpieza-aut_licenses.sql`); el usuario lo ejecutará en el proyecto AUTOSTOCK antes de avanzar.

## Convenciones

- Todo en español; prefijos commit: `fix:`, `feat:`, `checkpoint:`, `chore:`.
- `docs/` y `config_session/` SÍ se versionan en este repo (decisión bootstrap: no repetir la pérdida de historial de planes de Gallos).
- `.env` gitignoreado: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` cuando exista el panel.
- Actualizar este `memory.md` al final de cada sesión.

## Último Checkpoint

- **`ee27595`** — chore: bootstrap repositorio AuthCenter (root-commit: git init, .gitignore, AGENTS.md, rules ajustada regla 5 → `npm run build`, memory completo, scripts SQL 00–04 byte-idénticos al origen f307a1c de Gallos, plan versionado en docs/).
