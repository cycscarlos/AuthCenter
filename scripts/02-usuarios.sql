-- ============================================================
-- AUTHCENTER · 02 - TABLA "usuarios" (administradores del centro)
-- Proyecto: AuthCenter
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de 01)
-- Idempotente.
--
-- Versión mínima del patrón Gallos:
--   * id ↔ auth.users.id (se crea el usuario en Authentication primero,
--     luego su fila aquí).
--   * El primer admin se da de alta MANUALMENTE (Dashboard):
--       1) Authentication → Add user (email + contraseña)
--       2) Copiar su UUID y ejecutar el INSERT comentado abajo.
--   * Las Edge Functions revalidan el rol CONTRA ESTA TABLA (SERVICE_ROLE);
--     el JWT user_metadata es solo la capa RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usuarios (
    id         uuid PRIMARY KEY, -- REFERENCES auth.users(id) ON DELETE CASCADE
    email      text NOT NULL,
    nombre     text NOT NULL,
    rol        text NOT NULL DEFAULT 'soporte'
               CHECK (rol IN ('admin','soporte')),
    activo     boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ac_usuarios_rol ON public.usuarios (rol);

-- RLS: lectura propia o admin/soporte; escritura solo admin (patrón Gallos).
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ac_usuarios_select_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_select_jwt" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (auth.jwt() -> 'user_metadata' ->> 'rol') IN ('admin', 'soporte')
  );

DROP POLICY IF EXISTS "ac_usuarios_insert_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_insert_jwt" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "ac_usuarios_update_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_update_jwt" ON public.usuarios
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

DROP POLICY IF EXISTS "ac_usuarios_delete_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_delete_jwt" ON public.usuarios
  FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin' AND id <> auth.uid());

REVOKE ALL ON public.usuarios FROM anon;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ac_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER trg_ac_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Alta manual del PRIMER ADMIN (reemplazar <UUID_AUTH_USER> y datos):
-- INSERT INTO public.usuarios (id, email, nombre, rol)
-- VALUES ('<UUID_AUTH_USER>', 'admin@tudominio.com', 'Administrador', 'admin');

-- Verificación opcional:
-- SELECT email, rol, activo FROM public.usuarios;
