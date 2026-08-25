-- ============================================================
-- AUTHCENTER · 01 - TABLA "productos"
-- Proyecto: AuthCenter (Supabase NUEVO y dedicado — NO galloslosindios)
-- Ejecutar en: Supabase Dashboard → SQL Editor (verificar proyecto correcto)
-- Idempotente: puede ejecutarse varias veces sin errores.
--
-- Dimensión multi-producto del emisor central:
--   * Cada licencia pertenece a UN producto (FK en aut_licenses).
--   * Alta/baja de productos: por SQL (sin CRUD de funciones en el MVP).
--   * Desactivar un producto bloquea nuevas emisiones y la validación
--     de sus claves (validate-license responderá producto_inactivo).
-- ============================================================

-- 0) Extensión requerida
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tabla
CREATE TABLE IF NOT EXISTS public.productos (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo     varchar(20) NOT NULL UNIQUE,
    nombre     varchar(100) NOT NULL,
    activo     boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

-- 2) Catálogo inicial (según decisión D3 del plan)
INSERT INTO public.productos (codigo, nombre) VALUES
    ('AUTOSTOCK', 'AutoStock'),
    ('MEDSTOCK',  'MedStock'),
    ('POSADAS',   'Posadas')
ON CONFLICT (codigo) DO NOTHING;

-- 3) Índices
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON public.productos (codigo);

-- 4) RLS: solo rol 'admin' autenticado (viaja en el JWT user_metadata,
--    mismo patrón que Gallos; las funciones además revalidan contra la
--    tabla usuarios con SERVICE_ROLE).
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "productos_select_jwt" ON public.productos;
CREATE POLICY "productos_select_jwt" ON public.productos
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "productos_insert_jwt" ON public.productos;
CREATE POLICY "productos_insert_jwt" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "productos_update_jwt" ON public.productos;
CREATE POLICY "productos_update_jwt" ON public.productos
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "productos_delete_jwt" ON public.productos;
CREATE POLICY "productos_delete_jwt" ON public.productos
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

-- 5) Endurecimiento: anon nunca toca esta tabla
REVOKE ALL ON public.productos FROM anon;

-- 6) Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_updated_at ON public.productos;
CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7) Verificación opcional tras ejecutar:
-- SELECT codigo, nombre, activo FROM public.productos ORDER BY codigo;
--   → debe listar AUTOSTOCK / MEDSTOCK / POSADAS
