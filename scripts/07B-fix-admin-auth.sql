-- ============================================================
-- AUTHCENTER · 07B - CORRECCIÓN COMPLETA DE AUTH Y ADMIN USER
-- Proyecto: AuthCenter (REF ijvevdplnovkewxifpmf)
-- ⚠️ VERIFICAR que el proyecto seleccionado sea AuthCenter en Dashboard
-- ============================================================

-- 1. Confirmar email, asignar rol authenticated y establecer contraseña
UPDATE auth.users
SET 
    encrypted_password = crypt('Best_001*', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    aud                = 'authenticated',
    role               = 'authenticated',
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"rol": "admin"}'::jsonb
WHERE id = 'd830e483-1a13-490a-a2b7-018f75640fa8' OR email = 'alchemy.zcoder@gmail.com';

-- 2. Asegurar que exista la fila correspondiente en public.usuarios con rol admin
INSERT INTO public.usuarios (id, email, nombre, rol, activo)
VALUES (
    'd830e483-1a13-490a-a2b7-018f75640fa8',
    'alchemy.zcoder@gmail.com',
    'Administrador Principal',
    'admin',
    true
)
ON CONFLICT (id) DO UPDATE 
SET rol = 'admin', activo = true;

-- 3. Verificación de resultado:
-- SELECT id, email, email_confirmed_at, raw_user_meta_data FROM auth.users WHERE email = 'alchemy.zcoder@gmail.com';
-- SELECT id, email, rol, activo FROM public.usuarios WHERE email = 'alchemy.zcoder@gmail.com';
