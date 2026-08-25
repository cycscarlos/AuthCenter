# Plan — Emisor Central de Licencias ("AuthCenter")

**Fecha:** 25/08/2026
**Estado:** PROPUESTO — pendiente de autorización del usuario **fase por fase** (regla 1 de `config_session/rules.md`)
**Origen:** decisión de sesión 25/08 — el módulo de licenciamiento de Gallos resultó agnóstico en su núcleo; el usuario necesita el escenario centralizado YA.

---

## 1. Objetivo

Aplicación independiente y 100% agnóstica que administra las licencias de uso de TODOS los proyectos del usuario (AutoStock, MedStock, Posadas y futuros) desde un **punto único**: emisión, vigencia manual, revocación y validación vía API.

Este plan corrige por diseño las deficiencias de los 3 sistemas previos analizados (Posadas, AutoStock, MedStock): RLS desde el día 1, secretos sin fallback ni commits, clave con serial aleatorio firmado (no determinista), CRUD admin completo y multi-producto.

## 2. Principios rectores

- **Nada se ejecuta contra BDs vivas sin backup previo (script 00) y autorización escrita.**
- Cada fase termina verificablemente antes de empezar la siguiente (`npm run build`, smoke test, o validación del usuario).
- El módulo de licenciamiento ACTUAL de Gallos **no se toca** (Gallos no es un producto licenciado; migrarlo al centro queda como decisión futura separada).
- Los secretos NUNCA se muestran ni se commitean; solo se configuran con `supabase secrets set` (terminal del usuario).
- Todo en español (código, UI, commits).

## 3. Decisiones previas (D1–D7) — BLOQUEAN el inicio

| # | Decisión | Recomendación |
|---|----------|---------------|
| D1 | Dónde vive AuthCenter | **Proyecto Supabase NUEVO y dedicado** (en la org actual `urqswilspeawfploenne`). NO reutilizar `galloslosindios`. AutoStock está en otra org (`aeqlcnsjliwequcshamf`) pero eso no importa: consumirá la API por HTTPS. |
| D2 | Dónde vive el panel | **App standalone propia** (Vite multi-página vanilla JS, mismo stack que Gallos) desplegada en **Vercel aparte**, con su `vercel.json` y CSP propios. |
| D3 | Modelo multi-producto | Tabla `productos` (código único, nombre, activo) + `producto_id` FK en `aut_licenses`. Alta de productos inicialmente por SQL (sin CRUD de funciones). |
| D4 | Secretos | **Un secreto por producto** (`LICENSE_SECRET_AUTOSTOCK`, `LICENSE_SECRET_MEDSTOCK`, …): comprometer el secreto de un cliente no afecta a los demás, y permite rotación aislada. |
| D5 | Licencias históricas | Backfill OPCIONAL de licencias existentes de los sistemas anteriores (si las hay activas). Sin backfill, se emiten de cero. |
| D6 | Política offline en clientes | Documentada aquí, implementada en cada producto cliente: validar al iniciar + caché local con período de gracia (p. ej. 72 h) + revalidación periódica. Mitiga el punto único de falla. |
| D7 | Administradores | Tabla `usuarios` del proyecto AuthCenter con rol `admin` (mismo patrón que Gallos). Alta inicial del primer admin por SQL/dashboard; después altas desde el panel. |

> ⚠️ El usuario debe confirmar D1–D7 (o corregirlas) antes de ejecutar la Fase 1.

---

## 4. Fases de ejecución

### Fase 0 — Checkpoint y preparación

| Tarea | Complejidad | Riesgo |
|-------|-------------|--------|
| 0.1 Commit `checkpoint:` en el repo actual dejando constancia en `memory.md` (no habrá cambios de código aún, pero se fija el punto de referencia) | baja | bajo |
| 0.2 Confirmación escrita de D1–D7 por el usuario | baja | bajo |
| 0.3 Crear proyecto Supabase AuthCenter (dashboard del usuario) + anotar URL/anon key en `.env` local del nuevo repo | baja | bajo |

### Fase 1 — Base de datos (AuthCenter)

| Tarea | Complejidad | Riesgo |
|-------|-------------|--------|
| 1.1 Script `00-backup-snapshot.sql` adaptado a AuthCenter (vacío al inicio, sirve de plantilla blindada) | baja | bajo |
| 1.2 Script SQL `productos` (id, codigo UNIQUE, nombre, activo bool) + seed inicial de 3 productos (AUTOSTOCK, MEDSTOCK, POSADAS) | baja | bajo |
| 1.3 Script SQL `usuarios` (perfil admin del centro: id UUID ↔ auth.users, nombre, rol CHECK admin/soporte) — versión mínima del patrón Gallos | media | medio |
| 1.4 Script SQL `aut_licenses` v2: hereda todo el diseño actual (license_key varchar(24) UNIQUE, cliente, tipo CHECK demo/prueba/licencia, duracion_dias CHECK 1–365, fecha_inicio NULL=pendiente, expires_at, is_active, notas, created_by DEFAULT auth.uid(), activada_en, updated_at) **+ `producto_id` FK NOT NULL** + CHECK coherencia de fechas | media | medio |
| 1.5 Índices: `(producto_id)`, `(expires_at)` parcial sobre is_active, `(cliente)` para búsqueda | baja | bajo |
| 1.6 RLS: políticas solo-admin vía JWT `user_metadata` (patrón gastos/licencias actual) + `REVOKE ALL ON ... FROM anon` + triggers `updated_at` | media | medio |
| 1.7 Tabla `rate_limits` + función `rate_limit_consume` SECURITY DEFINER (port exacto del M1 de Gallos) | media | medio |
| 1.8 Ejecución de scripts en SQL Editor por el usuario (orden 00→01…) + verificación con probe REST (403 esperado para anon) | baja | medio (BD viva) |

### Fase 2 — Edge Functions (AuthCenter)

| Tarea | Complejidad | Riesgo |
|-------|-------------|--------|
| 2.1 `_shared/license-keys.ts`: port del generador HMAC-SHA256 WebCrypto + serial aleatorio + verificación timing-safe, con `getLicenseSecret(producto)` que resuelve el secreto por producto — **sin fallback**, error si <32 chars | media | medio |
| 2.2 `create-license`: JWT → rol admin en `usuarios` del centro → valida producto existe/activo → sanitiza → genera con reintento ante 23505 → `expires_at` = inicio+duración−1 UTC → `activada_en` si hay fecha. Rate limit distribuido (write) | alta | medio |
| 2.3 `validate-license`: pública (`verify_jwt=false`), rate limit read 30/min por IP, recibe `producto` + `clave`; HMAC ANTES de tocar BD; fail-closed 503; respuesta mínima `{valida, estado, fecha_inicio, expires_at, dias_restantes}`; estados nuevos: `producto_invalido` / `producto_inactivo` además de los 8 actuales | media | medio |
| 2.4 `sync-user-role` simplificado (o alta de admins solo por SQL — decidir según D7) | baja | medio |
| 2.5 `config.toml`: entradas con `verify_jwt=false` donde aplique (autorización propia en cada función) | baja | bajo |
| 2.6 Secretos por producto vía `supabase secrets set` (terminal del usuario; valores nunca mostrados) + deploy de funciones + smoke rápido de firma | baja | medio |

### Fase 3 — Panel de administración standalone

| Tarea | Complejidad | Riesgo |
|-------|-------------|--------|
| 3.1 Scaffold nuevo repo/proyecto: Vite multi-página, `src/lib/` portado (supabase.js, auth.js, api.js, escape.js, image-utils no necesario) | media | bajo |
| 3.2 Login + guard `isAdmin()` (UI) — la seguridad real sigue en RLS y funciones | media | medio |
| 3.3 Vista Licencias: port del módulo actual + selector/filtro por producto obligatorio (stat-cards Activas/Por expirar/Pendientes; chips semáforo; badges de estado; filas apagadas; modal crear/editar con sincronía duración↔fecha_fin; copiar clave; revocar/reactivar; eliminar con confirm; CSV `;`+BOM; table-nav; cards ≤768px) | alta | medio |
| 3.4 Vista Productos: lectura + activar/desactivar (alta de productos por SQL según D3; si el usuario quiere CRUD completo, se añade función `upsert-producto` admin-only) | media | bajo |
| 3.5 Vista Usuarios del centro (opcional MVP: solo lectura; altas por SQL) | baja | bajo |
| 3.6 CSS propio (base oscura dorada ya existente como referencia) + favicon + print CSV/PDF | media | bajo |
| 3.7 `vercel.json` con headers/CSP propios + deploy en Vercel (proyecto nuevo) | media | medio |

### Fase 4 — Integración de clientes (repetible por producto)

| Tarea | Complejidad | Riesgo |
|-------|-------------|--------|
| 4.1 Documento de contrato público de `validate-license` (request/response/estados/códigos de error/política de gracia) en `docs/contrato-validate-license.md` | baja | bajo |
| 4.2 Adaptador cliente de referencia (snippet por lenguaje de cada app): validar al iniciar + caché con gracia 72 h + revalidación cada 24 h | media | medio |
| 4.3 **AutoStock:** conectar al endpoint central, retirar su licenciador anterior y **rotar sus secretos commiteados** (deficiencia conocida). Otra org Supabase → consume API externa sin problema | alta | alto |
| 4.4 **MedStock:** mismo port (misma org que Gallos/AuthCenter) | alta | medio |
| 4.5 **Posadas:** mismo port | alta | medio |
| 4.6 Backfill opcional de licencias históricas (según D5) | baja | bajo |

### Fase 5 — Verificación y cierre

| Tarea | Complejidad | Riesgo |
|-------|-------------|--------|
| 5.1 Smoke test end-to-end: crear licencia → validar (activa) → expirarla manualmente → validar (expirada) → revocar → validar (revocada) → clave falsa (firma_invalida) → producto inactivo. Resultados en `docs/resultado-smoke-tests-authcenter.md` | media | bajo |
| 5.2 Documento de operación: rotación de secretos (implica reemitir claves de ese producto), alta de producto nuevo (SQL + secreto), recuperación ante caída | baja | medio |
| 5.3 Actualizar `memory.md` + push a producción por el usuario | baja | bajo |

---

## 5. Dependencias críticas

1. D1–D7 confirmadas → Fase 1.
2. Fase 1 completa (BD viva verificada) → Fase 2.
3. Fase 2 desplegada + smoke de firma PASS → Fase 3 (el panel puede desarrollarse en paralelo contra localhost de funciones, pero no se valida end-to-end sin Fase 2).
4. Panel validado por el usuario → Fase 4 (una app a la vez; AutoStock primero por ser la de mayor riesgo).
5. Login interactivo de Supabase CLI **solo funciona en la terminal del usuario** (shell del agente es non-TTY): deploys y secretos los ejecuta él.

## 6. Riesgos generales y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Punto único de falla (caída de AuthCenter bloquea todos los productos) | D6: caché offline + período de gracia en clientes; fail-closed solo para red, nunca para bugs de código |
| Brecha centralizada afecta todo | Secretos por producto (D4); RLS día 1; rate limit; HMAC antes de BD |
| Rotación de secretos invalida claves emitidas | Documentado en 5.2: rotación ⇒ reemisión planificada |
| Migración precipitada de clientes rompe producción | Fase 4 una app por vez, con rollback conocido (licenciador anterior se conserva hasta validar el nuevo) |
| Ejecución SQL en proyecto equivocado (ya ocurrió con el SQL 05 en AutoStock) | Regla operativa: verificar SIEMPRE en el dashboard que el proyecto seleccionado sea **AuthCenter** antes de ejecutar cualquier script |

## 7. Fuera de alcance de este plan

- Migrar el licenciamiento interno de Gallos al centro (Gallos no vende licencias; decisión futura).
- Pagos/suscripciones automáticas, trials automáticos, telemetry de activaciones (posibles fases futuras).
- Inventario/nómina u otras features de los productos clientes.
