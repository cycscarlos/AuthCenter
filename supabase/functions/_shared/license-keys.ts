/**
 * Helper compartido del emisor central de licencias AuthCenter.
 *
 * Formato de clave: XXXX-XXXX-XXXX-XXXX-XXXX  (20 hex + 4 guiones = 24 chars)
 *   - Chars 1-6  : YYMMDD de la fecha de GENERACIÓN (solo informativo)
 *   - Chars 7-12 : serial aleatorio (6 hex) => claves únicas, sin determinismo
 *   - Chars 13-20: HMAC-SHA256(SECRETO_PRODUCTO, fecha+serial) truncado a 8 hex
 *
 * Multi-producto (D4): CADA producto tiene su propio secreto
 *   LICENSE_SECRET_<CODIGO> (p. ej. LICENSE_SECRET_AUTOSTOCK).
 *   Comprometer el secreto de un cliente no afecta a los demás.
 *
 * Reglas heredadas del módulo de Gallos:
 *   - Serial aleatorio: sin claves repetidas por fecha ni hacks de colisión.
 *   - La vigencia NO se deriva del prefijo: la fuente de verdad es la tabla
 *     aut_licenses.
 *   - Sin fallback de secreto: si falta o es débil, se lanza error (fail-closed).
 */

const SERIAL_HEX_LENGTH = 6;
const SIG_HEX_LENGTH = 8;
const KEY_HEX_LENGTH = 20; // 6 fecha + 6 serial + 8 firma

/** Formato válido del código de producto (columna productos.codigo). */
export const PRODUCTO_RE = /^[A-Z][A-Z0-9_]{1,19}$/;

/**
 * Obtiene el secreto HMAC del producto desde los secretos de Supabase.
 * Lanza error si no está configurado o es débil (NUNCA usar fallback).
 */
export function getLicenseSecret(producto: string): string {
  if (!PRODUCTO_RE.test(producto)) {
    throw new Error('Codigo de producto con formato invalido');
  }
  const secret = Deno.env.get(`LICENSE_SECRET_${producto}`);
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      `LICENSE_SECRET_${producto} no configurada (minimo 32 caracteres)`
    );
  }
  return secret.trim();
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(firma);
}

/** Comparación en tiempo constante (evita filtrar información por timing). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Quita guiones y espacios, pasa a mayúsculas. */
export function normalizeKey(key: string | null | undefined): string {
  return String(key ?? '').replace(/[\s-]/g, '').toUpperCase();
}

/** ¿Cumple el formato de 20 hex? */
export function isValidKeyFormat(key: string): boolean {
  return /^[A-F0-9]{20}$/.test(normalizeKey(key));
}

/** Convierte 20 hex continuos a formato agrupado XXXX-XXXX-XXXX-XXXX-XXXX. */
export function toGroupedFormat(cleanHex: string): string {
  return (cleanHex.match(/.{4}/g) ?? []).join('-');
}

/**
 * Genera una clave nueva: YYMMDD(generación UTC) + serial aleatorio + HMAC truncado.
 */
export async function generateLicenseKey(
  generatedAt: Date,
  secret: string
): Promise<string> {
  const yy = String(generatedAt.getUTCFullYear()).slice(2);
  const mm = String(generatedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(generatedAt.getUTCDate()).padStart(2, '0');
  const rawDate = `${yy}${mm}${dd}`;

  const bytes = crypto.getRandomValues(
    new Uint8Array(SERIAL_HEX_LENGTH / 2)
  );
  const serial = toHex(bytes.buffer).toUpperCase();

  const firma = (
    await hmacSha256(secret, rawDate + serial)
  ).slice(0, SIG_HEX_LENGTH).toUpperCase();

  return toGroupedFormat(rawDate + serial + firma);
}

/**
 * Verifica la firma HMAC de una clave (timing-safe).
 * NO valida vigencia ni producto: eso se consulta en la tabla aut_licenses.
 */
export async function verifyLicenseKey(
  key: string,
  secret: string
): Promise<boolean> {
  const cleaned = normalizeKey(key);
  if (!/^[A-F0-9]{20}$/.test(cleaned)) return false;

  const esperada = (
    await hmacSha256(secret, cleaned.slice(0, KEY_HEX_LENGTH - SIG_HEX_LENGTH))
  ).slice(0, SIG_HEX_LENGTH).toUpperCase();

  return timingSafeEqual(esperada, cleaned.slice(-SIG_HEX_LENGTH));
}
