# Contexto de Sesión — AuthCenter

## Qué es

Emisor central de licencias agnóstico y multi-producto (AutoStock, MedStock, Posadas y futuros). Proyecto NUEVO e independiente; repo hermano de Gallos-los-indios (`../Gallos-los-indios`). El módulo de licencias interno de Gallos NO se toca desde aquí.

## Stack decidido

- **Panel:** Vanilla JS (ES modules) + Vite multi-página — scaffold pendiente (Fase 3 del plan).
- **Backend:** proyecto Supabase DEDICADO nuevo (D1) + Edge Functions Deno.
- **Deploy panel:** Vercel aparte (D2).
- Hoy NO existe package.json ni build; verificación = revisión directa hasta el scaffold.

## Decisiones confirmadas por el usuario (25/08)

- D1 Supabase nuevo y dedicado (org urqswilspeawfploenne), NO galloslosindios. **AÚN SIN CREAR** — el usuario quiere hacer preguntas antes de crearlo.
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
- **PENDIENTE USUARIO (orden crítico):**
  1. Preguntas previas → crear proyecto Supabase AuthCenter (D1) y anotar URL/anon key.
  2. SQL Editor VERIFICANDO proyecto = AuthCenter → ejecutar 01 → 02 → 03 → 04 (00 opcional vacía), corriendo verificaciones comentadas tras cada uno.
  3. Alta manual primer admin tras 02 (Authentication → INSERT con UUID).
  4. Probe REST: anon debe recibir 403 permission denied (= RLS activo día 1).
- **Fase 2 (Edge Functions)** bloqueada hasta completar lo anterior.
- **Pendiente externo:** issue en AutoStock — una tabla mal creada (el usuario lo resolverá antes de avanzar a integraciones).

## Convenciones

- Todo en español; prefijos commit: `fix:`, `feat:`, `checkpoint:`, `chore:`.
- `docs/` y `config_session/` SÍ se versionan en este repo (decisión bootstrap: no repetir la pérdida de historial de planes de Gallos).
- `.env` gitignoreado: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` cuando exista el panel.
- Actualizar este `memory.md` al final de cada sesión.

## Último Checkpoint

- **`ee27595`** — chore: bootstrap repositorio AuthCenter (root-commit: git init, .gitignore, AGENTS.md, rules ajustada regla 5 → `npm run build`, memory completo, scripts SQL 00–04 byte-idénticos al origen f307a1c de Gallos, plan versionado en docs/).
