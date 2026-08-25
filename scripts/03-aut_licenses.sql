-- ============================================================
-- AUTHCENTER · 03 - TABLA "aut_licenses" v2 (multi-producto)
-- Proyecto: AuthCenter
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de 01 y 02)
-- Idempotente.
--
-- Port del módulo de Gallos (scripts/05-tabla-aut_licenses.sql) con la
-- dimensión central añadida:
--   * producto_id FK NOT NULL → public.productos (RESTRICT: no se puede
--     borrar un producto con licencias asociadas).
-- Modelo de licencia (igual que Gallos):
--   * El admin genera la clave y define tipo + duración (1-365 días).
--   * La vigencia corre SOLO cuando el admin fija manualmente fecha_inicio.
--   * expires_at es la fuente de verdad (la clave NO codifica la vigencia).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.aut_licenses (
    id            bigserial PRIMARY KEY,
    producto_id   uuid NOT NULL REFERENCES public.productos(id),
    license_key   varchar(24) NOT NULL UNIQUE,
    cliente       varchar(120),
    tipo          varchar(10) NOT NULL DEFAULT 'prueba'
                  CHECK (tipo IN ('demo','prueba','licencia')),
    duracion_dias integer NOT NULL CHECK (duracion_dias BETWEEN 1 AND 365),
    fecha_inicio  date,
    expires_at    date,
    is_active     boolean NOT NULL DEFAULT true,
    notas         text,
    created_by    uuid DEFAULT auth.uid(),
    activada_en   timestamptz,
    created_at    timestamptz DEFAULT timezone('utc', now()),
    updated_at    timestamptz DEFAULT timezone('utc', now()),
    CONSTRAINT aut_licenses_fechas_chk CHECK (
        fecha_inicio IS NULL OR expires_at IS NULL OR expires_at >= fecha_inicio
    )
);

-- Índices (filtros frecuentes del panel + validación)
CREATE INDEX IF NOT EXISTS idx_ac_lic_producto ON public.aut_licenses (producto_id);
CREATE INDEX IF NOT EXISTS idx_ac_lic_expires ON public.aut_licenses (is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_ac_lic_tipo ON public.aut_licenses (tipo);
CREATE INDEX IF NOT EXISTS idx_ac_lic_cliente ON public.aut_licenses (cliente);

-- RLS: solo rol 'admin' autenticado (JWT user_metadata; patrón Gallos).
ALTER TABLE public.aut_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_lic_select_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_select_jwt" ON public.aut_licenses
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "ac_lic_insert_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_insert_jwt" ON public.aut_licenses
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "ac_lic_update_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_update_jwt" ON public.aut_licenses
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "ac_lic_delete_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_delete_jwt" ON public.aut_licenses
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

-- Endurecimiento día 1: anon nunca toca licencias (lección de los sistemas
-- previos: sin esto cualquiera con la anon key podría extender su licencia).
REVOKE ALL ON public.aut_licenses FROM anon;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ac_lic_updated_at ON public.aut_licenses;
CREATE TRIGGER trg_ac_lic_updated_at
  BEFORE UPDATE ON public.aut_licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Verificación opcional tras ejecutar:
-- SELECT count(*) FROM public.aut_licenses;  -- debe devolver 0 sin error
-- Prueba de integridad (solo funciona como admin; requiere un producto):
-- INSERT INTO public.aut_licenses (producto_id, license_key, tipo, duracion_dias)
--   SELECT id, 'TEST-TEST-TEST-TEST-TEST', 'demo', 7 FROM public.productos
--   WHERE codigo='AUTOSTOCK';
-- DELETE FROM public.aut_licenses WHERE license_key = 'TEST-TEST-TEST-TEST-TEST';
