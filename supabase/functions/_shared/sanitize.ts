/**
 * Sanitización de datos para Edge Functions de AuthCenter.
 * Solo los helpers usados por create-license (patrón Gallos).
 */

// Patrones de XSS a eliminar
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
];

/**
 * Sanitiza texto plano (trim, límite de longitud, patrones XSS, controles).
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Limitar longitud (protección DoS)
  if (sanitized.length > 10000) {
    sanitized = sanitized.slice(0, 10000);
  }

  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Eliminar caracteres de control excepto espacios
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Sanitiza número entero dentro de un rango. Devuelve null si es inválido.
 */
export function sanitizeInteger(
  value: string | number | null | undefined,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (num < min || num > max) {
    return null;
  }

  return num;
}

export default {
  sanitizeText,
  sanitizeInteger,
};
