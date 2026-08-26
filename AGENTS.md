# AGENTS.md — AuthCenter

Emisor central de licencias **agnóstico y multi-producto** (AutoStock, MedStock, Posadas y futuros). Backend Supabase DEDICADO (Auth + Postgres + Edge Functions Deno), panel admin vanilla JS (ES modules) + Vite multi-página, deploy del panel en Vercel. Todo el código, UI y mensajes de commit en **español**.

Este proyecto es INDEPENDIENTE de Gallos-los-indios (repo hermano en `../Gallos-los-indios`). El módulo `/admin/licencias` interno de Gallos NO se toca desde aquí.

## Estado actual

- Bootstrap inicial: scripts SQL de BD (`scripts/`), plan maestro (`docs/plan-emisor-central-licencias.md`), configuración opencode.
- Proyecto Supabase "AuthCenter" **CREADO** en la org alchemy (junto a AutoStock — el límite Free pasó a 2 proyectos/org). **Pendiente: ejecutar los scripts SQL 01→04 en él.**
- Sin `package.json` todavía: el scaffold Vite llega con la Fase 3 del plan.

## Comandos

- Hoy no hay build; cuando exista el scaffold: `npm run dev`, `npm run build` (verificación principal antes de entregar cambios), `npm run preview`.
- Edge Functions se despliegan con la CLI de Supabase **vinculada al proyecto AuthCenter**. Antes de cualquier `deploy` o `secrets set`, VERIFICAR que el proyecto linkeado sea AuthCenter (la sesión CLI puede quedar apuntando a otro proyecto; el login interactivo solo funciona en terminal del usuario).

## Arquitectura prevista (decisiones D1–D7 confirmadas 25/08)

- **D1** Proyecto Supabase nuevo y dedicado (org `urqswilspeawfploenne`). NO galloslosindios.
- **D2** Panel standalone propio desplegado en Vercel aparte.
- **D3** Tabla `productos` (codigo UNIQUE) + `producto_id` FK en `aut_licenses`; alta de productos por SQL.
- **D4** Un secreto por producto: `LICENSE_SECRET_AUTOSTOCK`, etc. Sin fallback; error si <32 chars.
- **D5** Backfill de licencias históricas OPCIONAL.
- **D6** Política offline cliente: validar al iniciar + caché/gracia 72 h + revalidación 24 h (se implementa en cada producto cliente).
- **D7** Admins vía tabla `usuarios` del centro (patrón Gallos); RLS lee rol del JWT `user_metadata`.

## Modelo de seguridad (crítico)

- RLS activo desde día 1 en TODAS las tablas + `REVOKE ALL ... FROM anon`.
- `validate-license`: pública (`verify_jwt = false`), rate limit distribuido por IP, verificación HMAC ANTES de tocar la BD, fail-closed (503 si el secreto falta o hay error).
- `create-license`: exige JWT y revalida rol `admin` CONTRA la tabla `usuarios` usando SERVICE_ROLE (no confiar solo en el JWT ni en RLS).
- Secretos NUNCA en código ni commits: solo `supabase secrets set`.

## Convenciones de trabajo

- Mismas reglas que Gallos (ver `config_session/rules.md`): autorización explícita antes de modificar, commit `checkpoint:` previo, backup de BD (`scripts/00-backup-snapshot.sql`) antes de tocar la BD viva, planes documentados por fases en `docs/`.
- Prefijos de commit: `fix:`, `feat:`, `checkpoint:`, `chore:`.
- Scripts SQL para SQL Editor van en `scripts/*.sql`, idempotentes, con queries de verificación comentadas al final.
- Al ejecutar SQL en el Dashboard: VERIFICAR SIEMPRE que el proyecto seleccionado sea AuthCenter (ya ocurrió ejecutar un script en el proyecto equivocado).

## Gotchas

- AutoStock vive en OTRA org Supabase (`aeqlcnsjliwequcshamf`); consumirá la API central por HTTPS sin problema.
- Issue conocido pendiente en AutoStock: una tabla mal creada (resolver antes de integrar ese cliente).
- Rotación de secretos invalida las claves firmadas de ese producto ⇒ implica reemisión planificada.
