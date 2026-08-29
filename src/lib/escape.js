// src/lib/escape.js — Escapado seguro de HTML para prevenir XSS
/**
 * Escapa caracteres especiales de HTML en un string.
 * Usar siempre al insertar texto de la BD en innerHTML.
 */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY.
 * Devuelve '—' si es nulo.
 */
export function fmtFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Devuelve un label y clase CSS para el chip de estado de una licencia.
 */
export function chipEstado(lic) {
  if (!lic.is_active) return { label: 'Revocada', cls: 'chip--revocada' };
  if (!lic.fecha_inicio) return { label: 'Pendiente', cls: 'chip--pendiente' };

  const hoy = new Date().toISOString().slice(0, 10);
  if (lic.fecha_inicio > hoy) return { label: 'Programada', cls: 'chip--programada' };

  const fin = lic.expires_at
    ? Date.parse(`${lic.expires_at}T23:59:59Z`)
    : NaN;

  if (isNaN(fin)) return { label: 'Sin fecha', cls: 'chip--pendiente' };

  const diasRestantes = Math.ceil((fin - Date.now()) / 86400000);
  if (diasRestantes <= 0)  return { label: 'Expirada',  cls: 'chip--expirada' };
  if (diasRestantes <= 7)  return { label: `${diasRestantes}d`, cls: 'chip--por-expirar' };
  return { label: 'Activa', cls: 'chip--activa' };
}
