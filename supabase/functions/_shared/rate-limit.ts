/**
 * Config y utilidades de rate limiting para las Edge Functions de AuthCenter.
 * Solo lo usado por create-license / validate-license; el control real es
 * distribuido vía _shared/distributed-rate-limit.ts (Postgres).
 */

export const RATE_LIMIT_CONFIGS = {
  // Emisión de licencias (muy restrictivo)
  create: { maxRequests: 5, windowMs: 60000 }, // 5 por minuto

  // Validación de claves (anti fuerza bruta / enumeración)
  read: { maxRequests: 30, windowMs: 60000 }, // 30 por minuto
} as const;

/**
 * Obtiene el identificador desde la request.
 * Prioridad: 1) X-Forwarded-For (IP), 2) X-Real-IP, 3) userId o fallback genérico.
 */
export function getIdentifier(req: Request, userId?: string): string {
  const forwardedFor = req.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim();
    return userId ? `${ip}:${userId}` : ip;
  }

  const realIp = req.headers.get('X-Real-IP');
  if (realIp) {
    return userId ? `${realIp}:${userId}` : realIp;
  }

  return userId || 'anonymous';
}

export default {
  RATE_LIMIT_CONFIGS,
  getIdentifier,
};
