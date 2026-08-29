-- ============================================================
-- Script 06 — Alta de producto: Gallos-los-indios
-- Proyecto: AuthCenter (REF ijvevdplnovkewxifpmf)
-- ⚠️ VERIFICAR que el proyecto seleccionado sea AuthCenter antes de ejecutar.
-- Idempotente: ON CONFLICT DO NOTHING → seguro re-ejecutar.
-- ============================================================

INSERT INTO public.productos (codigo, nombre, activo)
VALUES ('GALLOSLOSINDIOS', 'Gallos los Indios', true)
ON CONFLICT (codigo) DO NOTHING;

-- Verificación (debe listar 4 productos: AUTOSTOCK, MEDSTOCK, POSADAS, GALLOSLOSINDIOS):
-- SELECT id, codigo, nombre, activo, created_at FROM public.productos ORDER BY created_at;
