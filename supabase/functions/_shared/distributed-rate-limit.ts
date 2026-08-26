/**
 * Rate Limiting distribuido para Edge Functions
 * Basado en Postgres (tabla rate_limits + función rate_limit_consume),
 * compartido entre todas las instancias.
 * Ver script BD: scripts/04-rate-limit.sql
 */

interface SupabaseClientLike {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

export interface DistributedRateLimitResult {
  allowed: boolean
  remaining: number
  retryAfter: number
  error: string | null
}

/**
 * Consume una unidad del contador distribuido.
 * Fail-open: si el RPC falla (función no desplegada, BD caída, etc.) se permite
 * el paso y se registra una advertencia, para no degradar disponibilidad.
 */
export async function checkDistributedRateLimit(
  supabase: SupabaseClientLike,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<DistributedRateLimitResult> {
  try {
    const { data, error } = await supabase.rpc('rate_limit_consume', {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    })

    if (error) {
      console.warn(
        `[RateLimit] Error en rate_limit_consume (fail-open): ${error.message}`
      )
      return { allowed: true, remaining: maxRequests, retryAfter: 0, error: error.message }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== 'object') {
      console.warn('[RateLimit] Respuesta inesperada de rate_limit_consume (fail-open)')
      return { allowed: true, remaining: maxRequests, retryAfter: 0, error: 'unexpected response' }
    }

    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining),
      retryAfter: Number(row.retry_after),
      error: null,
    }
  } catch (err) {
    console.warn(`[RateLimit] Excepción en rate_limit_consume (fail-open): ${err.message}`)
    return { allowed: true, remaining: maxRequests, retryAfter: 0, error: err.message }
  }
}

/**
 * Headers estándar de rate limit para la respuesta
 */
export function getRateLimitHeaders(
  remaining: number,
  retryAfter: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(remaining),
  }

  if (retryAfter > 0) {
    headers['Retry-After'] = String(retryAfter)
  }

  return headers
}

export default {
  checkDistributedRateLimit,
  getRateLimitHeaders,
}
