-- ============================================================
-- AUTHCENTER · 04 - RATE LIMITING distribuido
-- Proyecto: AuthCenter
-- Ejecutar en: Supabase Dashboard → SQL Editor (al final)
-- Idempotente.
--
-- Port exacto del patrón M1 de Gallos (migración 20260818130000):
-- tabla de contadores + función SECURITY DEFINER con incremento atómico
-- (INSERT ... ON CONFLICT). Las Edge Functions invocan con SERVICE_ROLE.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id           text PRIMARY KEY,
    count        integer NOT NULL DEFAULT 0,
    window_start timestamptz NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS activo SIN políticas: acceso directo denegado; solo la función
-- rate_limit_consume (SECURITY DEFINER, owner) puede leer/escribir.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rate_limit_consume(
    p_key text,
    p_max_requests int,
    p_window_seconds int
)
RETURNS TABLE (allowed boolean, remaining int, retry_after int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_bucket timestamptz;
    v_count int;
BEGIN
    v_bucket := to_timestamp(
        floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
    );

    INSERT INTO public.rate_limits (id, count, window_start, updated_at)
    VALUES (p_key, 1, v_bucket, now())
    ON CONFLICT (id) DO UPDATE
        SET count = CASE
                WHEN rate_limits.window_start = v_bucket THEN rate_limits.count + 1
                ELSE 1
            END,
            window_start = CASE
                WHEN rate_limits.window_start = v_bucket THEN rate_limits.window_start
                ELSE v_bucket
            END,
            updated_at = now()
    RETURNING count INTO v_count;

    IF v_count > p_max_requests THEN
        RETURN QUERY SELECT
            false,
            0,
            GREATEST(0, extract(epoch from (
                v_bucket + make_interval(secs => p_window_seconds) - now()
            ))::int);
        RETURN;
    END IF;

    RETURN QUERY SELECT true, p_max_requests - v_count, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_limit_consume(text, int, int)
    TO anon, authenticated, service_role;

-- Verificación opcional (debe devolver allowed=true dos veces y false la 3ª):
-- SELECT * FROM public.rate_limit_consume('smoke-test', 2, 60);
-- SELECT * FROM public.rate_limit_consume('smoke-test', 2, 60);
-- SELECT * FROM public.rate_limit_consume('smoke-test', 2, 60);
-- DELETE FROM public.rate_limits WHERE id='smoke-test'; -- limpieza (owner)
