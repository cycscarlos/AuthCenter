-- ============================================================
-- AUTHCENTER · 07 - Establer/Cambiar Contraseña del Administrador
-- Proyecto: AuthCenter (REF ijvevdplnovkewxifpmf)
-- ⚠️ VERIFICAR que el proyecto seleccionado sea AuthCenter en Dashboard
-- ============================================================

-- Reemplaza 'TU_NUEVA_CONTRASEÑA' con la clave que desees usar para el login.
UPDATE auth.users
SET encrypted_password = crypt('Best_001*', gen_salt('bf'))
WHERE id = 'd830e483-1a13-490a-a2b7-018f75640fa8';

-- Verificación:
-- SELECT id, email, encrypted_password IS NOT NULL AS tiene_password FROM auth.users WHERE id = 'd830e483-1a13-490a-a2b7-018f75640fa8';
