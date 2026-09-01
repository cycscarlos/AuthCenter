-- ============================================================
-- AUTHCENTER · 08 - FIX RLS: ROL DESDE TABLA "usuarios"
-- Proyecto: AuthCenter (REF ijvevdplnovkewxifpmf)
-- ⚠️ VERIFICAR que el proyecto seleccionado sea AuthCenter en Dashboard
-- ⚠️ Ejecutar ANTES: scripts/00-backup-snapshot.sql
-- ============================================================
-- PROBLEMA
--   Las políticas *_jwt de productos, aut_licenses y usuarios leen el rol
--   desde auth.jwt() -> 'user_metadata' ->> 'rol'. user_metadata es EDITABLE
--   por el usuario final (Supabase lo permite con su token) => un usuario
--   común podría autoconcederse rol 'admin' y eludir RLS.
--
-- SOLUCIÓN
--   El rol se consulta en la tabla public.usuarios (única fuente de verdad,
--   alineada con D7 y con las Edge Functions que ya revalidan con
--   SERVICE_ROLE). user_metadata deja de usarse en contexto de seguridad.
--
-- NOTA SOBRE RECURSIÓN
--   No es posible consultar la tabla que se está protegiendo dentro de su
--   propia política (RLS entraría en recursión). Por eso se usan funciones
--   SECURITY DEFINER con search_path fijo: corren como el owner y NO aplican
--   RLS en su consulta interna, lo que evita recursión y acceso indebido.
-- ============================================================

-- 1) Funciones auxiliares (fuente de verdad: public.usuarios)
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol = 'admin'
      AND u.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.es_admin_o_soporte()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.rol IN ('admin', 'soporte')
      AND u.activo = true
  );
$$;

-- Sellar acceso a las funciones: solo el rol authenticated puede invocarlas.
REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_admin_o_soporte() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_o_soporte() TO authenticated;

-- 2) TABLA productos ---------------------------------------------------------

DROP POLICY IF EXISTS "productos_select_jwt" ON public.productos;
CREATE POLICY "productos_select_jwt" ON public.productos
  FOR SELECT TO authenticated
  USING (public.es_admin());

DROP POLICY IF EXISTS "productos_insert_jwt" ON public.productos;
CREATE POLICY "productos_insert_jwt" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "productos_update_jwt" ON public.productos;
CREATE POLICY "productos_update_jwt" ON public.productos
  FOR UPDATE TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "productos_delete_jwt" ON public.productos;
CREATE POLICY "productos_delete_jwt" ON public.productos
  FOR DELETE TO authenticated
  USING (public.es_admin());

-- 3) TABLA aut_licenses ------------------------------------------------------

DROP POLICY IF EXISTS "ac_lic_select_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_select_jwt" ON public.aut_licenses
  FOR SELECT TO authenticated
  USING (public.es_admin());

DROP POLICY IF EXISTS "ac_lic_insert_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_insert_jwt" ON public.aut_licenses
  FOR INSERT TO authenticated
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "ac_lic_update_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_update_jwt" ON public.aut_licenses
  FOR UPDATE TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "ac_lic_delete_jwt" ON public.aut_licenses;
CREATE POLICY "ac_lic_delete_jwt" ON public.aut_licenses
  FOR DELETE TO authenticated
  USING (public.es_admin());

-- 4) TABLA usuarios ----------------------------------------------------------

DROP POLICY IF EXISTS "ac_usuarios_select_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_select_jwt" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.es_admin_o_soporte()
  );

DROP POLICY IF EXISTS "ac_usuarios_insert_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_insert_jwt" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "ac_usuarios_update_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_update_jwt" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "ac_usuarios_delete_jwt" ON public.usuarios;
CREATE POLICY "ac_usuarios_delete_jwt" ON public.usuarios
  FOR DELETE TO authenticated
  USING (public.es_admin() AND id <> auth.uid());

-- ============================================================
-- 5) VERIFICACIÓN (ejecutar en SQL Editor después de correr el script)
-- ============================================================
-- Debe devolver 1 fila (tu admin) con rol 'admin':
-- SELECT email, rol, activo FROM public.usuarios WHERE activo = true;
--
-- Debe devolver 0 filas → ya no quedan políticas que mencionen user_metadata:
--   SELECT policyname, tablename FROM pg_policies
--   WHERE schemaname = 'public'
--     AND policyname LIKE '%_jwt'
--     AND (pg_get_expr(qual, 0) LIKE '%user_metadata%'
--          OR pg_get_expr(with_check, 0) LIKE '%user_metadata%');
--
-- La alerta de Security Advisor debe desaparecer al re-evaluar (refrescar
-- pestaña o esperar unos minutos).
-- ============================================================