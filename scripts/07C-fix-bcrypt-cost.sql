-- ============================================================
-- AUTHCENTER · 07C - OPTIMIZACIÓN DE HASH BCRYPT (COSTO 10 NATIVO)
-- Proyecto: AuthCenter (REF ijvevdplnovkewxifpmf)
-- ⚠️ VERIFICAR que el proyecto seleccionado sea AuthCenter en Dashboard
-- ============================================================

-- Actualizar la contraseña usando bcrypt con costo 10 (estándar nativo de Supabase GoTrue)
UPDATE auth.users
SET encrypted_password = crypt('Best_001*', gen_salt('bf', 10))
WHERE email = 'alchemy.zcoder@gmail.com';

-- Verificación:
-- SELECT email, substring(encrypted_password from 1 for 10) AS algoritmo FROM auth.users WHERE email = 'alchemy.zcoder@gmail.com';
