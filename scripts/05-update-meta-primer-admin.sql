-- ============================================================
-- AUTHCENTER · 05 - METADATA DEL PRIMER ADMIN (rol en JWT)
-- Proyecto: AuthCenter
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de 02 y del alta manual)
--
-- Las políticas RLS de "usuarios" leen el rol desde
-- auth.jwt() -> 'user_metadata' ->> 'rol'. El Dashboard NO permite
-- editar raw_user_meta_data desde la UI, por eso este UPDATE.
--
-- Idempotente: concatenar jsonb con la misma clave no duplica ni rompe.
-- El nuevo claim aparece en el JWT a partir del PRÓXIMO inicio de sesión.
-- ============================================================

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"rol": "admin"}'::jsonb
WHERE id = 'd830e483-1a13-490a-a2b7-018f75640fa8';

-- Verificación (debe devolver {"email_verified": true, "rol": "admin"}):
-- SELECT email, raw_user_meta_data FROM auth.users
-- WHERE id = 'd830e483-1a13-490a-a2b7-018f75640fa8';

-- Verificación cruzada (tabla usuarios debe tener la fila admin activa):
-- SELECT email, rol, activo FROM public.usuarios
-- WHERE id = 'd830e483-1a13-490a-a2b7-018f75640fa8';
