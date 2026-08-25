-- ============================================================================
-- AUTHCENTER · 00 - BACKUP MANUAL (snapshot)
-- ----------------------------------------------------------------------------
-- El plan Free de Supabase NO incluye backups programados. Este script crea
-- copias de los datos dentro de la propia BD como punto de rollback ANTES de
-- aplicar cambios estructurales o de datos en AuthCenter.
--
-- En un proyecto NUEVO y vacío no hay nada que copiar: este script es
-- DEFENSIVO (solo copia las tablas que ya existen) y sirve tanto hoy como
-- plantilla, como antes de cualquier cambio futuro.
--
-- Por qué en schema "snapshot":
--   * No se expone vía API REST (solo "public" y "graphql_public" lo están).
--   * Solo el owner (rol postgres, el del SQL Editor) puede leer.
--
-- RESTAURAR (si algo sale mal), desde el SQL Editor:
--   TRUNCATE TABLE public.productos;
--   INSERT INTO public.productos SELECT * FROM snapshot.<tabla>_<fecha>;
--   (idem aut_licenses / usuarios / rate_limits)
--
-- IMPORTANTE: verificar SIEMPRE en el dashboard que el proyecto seleccionado
-- sea AuthCenter antes de ejecutar (lección del SQL 05 ejecutado por error
-- en AutoStock).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS snapshot;

-- Copias defensivas: solo si la tabla existe aún.
DROP TABLE IF EXISTS snapshot.aut_licenses_bak;
DO $$
BEGIN
  IF to_regclass('public.aut_licenses') IS NOT NULL THEN
    CREATE TABLE snapshot.aut_licenses_bak AS SELECT * FROM public.aut_licenses;
  END IF;
END $$;

DROP TABLE IF EXISTS snapshot.productos_bak;
DO $$
BEGIN
  IF to_regclass('public.productos') IS NOT NULL THEN
    CREATE TABLE snapshot.productos_bak AS SELECT * FROM public.productos;
  END IF;
END $$;

DROP TABLE IF EXISTS snapshot.usuarios_bak;
DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    CREATE TABLE snapshot.usuarios_bak AS SELECT * FROM public.usuarios;
  END IF;
END $$;

-- Blindaje: RLS activo SIN políticas (solo owner/postgres accede) + revocación
-- explícita para anon/authenticated (defensa en profundidad).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['aut_licenses_bak','productos_bak','usuarios_bak'] LOOP
    IF to_regclass('snapshot.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE snapshot.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON SCHEMA snapshot FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA snapshot FROM PUBLIC, anon, authenticated;

-- Verificación: filas copiadas (0 filas o "no existe" es normal al inicio)
SELECT 'aut_licenses' AS tabla,
       CASE WHEN to_regclass('snapshot.aut_licenses_bak') IS NULL THEN NULL
            ELSE (SELECT COUNT(*) FROM snapshot.aut_licenses_bak) END AS filas
UNION ALL
SELECT 'productos',
       CASE WHEN to_regclass('snapshot.productos_bak') IS NULL THEN NULL
            ELSE (SELECT COUNT(*) FROM snapshot.productos_bak) END
UNION ALL
SELECT 'usuarios',
       CASE WHEN to_regclass('snapshot.usuarios_bak') IS NULL THEN NULL
            ELSE (SELECT COUNT(*) FROM snapshot.usuarios_bak) END;
