# Contexto de Sesión — AuthCenter

## Qué es
Emisor central de licencias agnóstico y multi-producto (AutoStock, MedStock, Posadas y futuros). Proyecto independiente; repo hermano de Gallos-los-indios.

## Stack y Arquitectura
- **Panel:** Vanilla JS (ES modules) + Vite multi-página (`index.html`, `/panel/licencias.html`, `/panel/productos.html`).
- **Backend:** Supabase DEDICADO en la org alchemy + Edge Functions Deno.
- **Deploy:** Vercel (standalone).

## Modelo de Seguridad y Decisiones
- Tabla `productos` + `producto_id` FK. Alta de productos por SQL.
- Un secreto por producto (`LICENSE_SECRET_AUTOSTOCK`, etc.), sin fallback.
- Cliente Offline: validación al iniciar, gracia 72h, revalidación 24h.
- Admins vía tabla `usuarios` del centro.
- RLS ajustado para no usar `user_metadata` (Security Advisor resuelto).

## Estado Actual (Fases 1, 2, 3 COMPLETADAS)
- Panel Admin funcional (Vite) con creación/edición de licencias, roles, copia al portapapeles, CSV. 
- Edge Functions operando optimizadas (<300ms, sin timeout).
- Integración de clientes (Fase 4):
  - **AutoStock:** COMPLETADO.
  - **MedStock:** COMPLETADO.
  - **Gallos-los-indios:** COMPLETADO.
- Las licencias antiguas de los productos integrados fueron eliminadas. Todo opera ahora desde AuthCenter.

## Pendientes Inmediatos
1. Integración de **Posadas** (último producto pendiente de la Fase 4, requiere adaptación al usar MySQL/AlwaysData.net).
2. Cerrar formalmente `docs/resultado-fase4-gallos.md` tras confirmación visual final de UI/UX en Gallos.

## Notas de Entorno y Convenciones
- Todo en español; prefijos: `fix:`, `feat:`, `checkpoint:`, `chore:`.
- `docs/` y `config_session/` se versionan en este repo.
- `.env` gitignoreado (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Configurado `files.watcherExclude` y `search.exclude` en `.vscode/settings.json` para control de consumo de RAM de Antigravity IDE.

*(Nota: El historial detallado de sesiones pasadas y fases fue movido a `memory_archive.md`)*
