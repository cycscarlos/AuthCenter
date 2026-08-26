# AuthCenter

**Emisor central de licencias de uso — agnóstico y multi-producto.**

Un único punto de administración que emite, controla vigencia, revoca y valida las licencias de TODOS los productos de CYCSWeb: **AutoStock**, **MedStock**, **Posadas** y los que vengan después.

---

## ¿Por qué existe?

Los tres productos tenían cada uno su propio sistema de licenciamiento, con deficiencias repetidas (sin RLS, secretos commiteados, claves deterministas). AuthCenter corrige todo eso **una sola vez** y sirve a todos por HTTPS:

| Producto | Acceso |
|----------|--------|
| AutoStock | API central (vive en otra org/cuenta Supabase — sin problema) |
| MedStock | API central |
| Posadas | API central |

## Arquitectura

```
┌───────────────────────────── AuthCenter ─────────────────────────────┐
│  Supabase dedicado                    Panel admin (standalone)       │
│  ├─ Postgres + RLS desde día 1       ├─ Vanilla JS + Vite (Fase 3)  │
│  ├─ Edge Functions (Deno)            ├─ Login + rol admin           │
│  │   ├─ create-license               └─ Deploy: Vercel aparte       │
│  │   └─ validate-license                                             │
│  └─ Rate limiting distribuido                                        │
└──────────────────────────────────────────────────────────────────────┘
            ▲ HTTPS                    ▲ HTTPS              ▲ HTTPS
      ┌─────┴─────┐             ┌──────┴──────┐        ┌─────┴─────┐
      │ AutoStock │             │   MedStock  │        │  Posadas  │
      └───────────┘             └─────────────┘        └───────────┘
   (validar al iniciar + caché local con gracia 72 h + revalidación 24 h)
```

## Modelo de seguridad

- **RLS activo desde el día 1** en todas las tablas + `REVOKE ALL ... FROM anon`. Nadie toca licencias sin ser admin autenticado.
- **Clave firmada:** `XXXX-XXXX-XXXX-XXXX-XXXX` (20 hex = YYMMDD de generación + serial aleatorio de 6 + HMAC-SHA256 truncado a 8). Serial aleatorio ⇒ claves no deterministas ni predecibles.
- **Un secreto HMAC por producto** (`LICENSE_SECRET_AUTOSTOCK`, …): comprometer un cliente no afecta a los demás. Sin fallbacks; error si el secreto falta o es <32 caracteres.
- **Validación fail-closed:** HMAC ANTES de tocar la base de datos; comparación timing-safe; ante cualquier error interno responde 503, nunca "válida".
- **Rate limiting distribuido** en Postgres (30 lecturas/min por IP en validación).
- Secretos solo vía `supabase secrets set`; jamás en código ni commits.

## Estados de una licencia

`activa · expirada · revocada · pendiente (sin fecha_inicio) · programada · desconocida · firma_invalida · formato_invalido`

La vigencia es **100% manual**: el admin fija fecha de inicio y duración (1–365 días); `expires_at` es la fuente de verdad (la clave NO codifica vigencia).

## Estructura del repositorio

```
scripts/          SQL idempotentes para SQL Editor (BD del emisor)
docs/             Planes de trabajo por fases
config_session/   Reglas + memoria de sesión (OpenCode)
AGENTS.md         Contexto operativo para agentes IA
supabase/         (Fase 2) functions/ + config.toml
panel/            (Fase 3) scaffold Vite del panel admin
```

## Puesta en marcha (base de datos)

> ⚠️ Verificar SIEMPRE en el Dashboard que el proyecto seleccionado sea **AuthCenter** antes de ejecutar SQL.

1. Ejecutar en orden: `scripts/01-productos.sql` → `02-usuarios.sql` → `03-aut_licenses.sql` → `04-rate-limit.sql` (todos idempotentes, con queries de verificación comentadas al final).
2. Primer admin: Authentication → Add user → copiar UUID → INSERT en `usuarios` con rol `admin` (comentado en el script 02).
3. Probe REST esperado: peticiones anónimas a las tablas deben devolver **403 permission denied** (= RLS activo).

## Roadmap

- [x] **Fase 0** — Bootstrap del repositorio
- [x] **Fase 1** — Scripts SQL de la base de datos
- [ ] Ejecución SQL en el proyecto Supabase + primer admin *(usuario)*
- [ ] **Fase 2** — Edge Functions (`create-license`, `validate-license`) + secretos por producto
- [ ] **Fase 3** — Panel de administración standalone (Vercel)
- [ ] **Fase 4** — Integración de clientes: AutoStock → MedStock → Posadas (una a la vez)
- [ ] **Fase 5** — Smoke tests end-to-end + documentación de operación

## Convenciones del proyecto

- Todo el código, UI y commits en **español** (prefijos: `fix:`, `feat:`, `checkpoint:`, `chore:`).
- Reglas de trabajo completas: [`config_session/rules.md`](config_session/rules.md) · contexto técnico: [`AGENTS.md`](AGENTS.md).
- Backup defensivo (`snapshot`) antes de cualquier cambio estructural en la BD viva.
