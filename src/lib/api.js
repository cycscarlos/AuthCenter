// src/lib/api.js — Capa de acceso a datos (licencias, productos, usuarios)
import { supabase } from './supabase.js';

// ─── LICENCIAS ───────────────────────────────────────────────────────────────

/**
 * Obtiene todas las licencias con join a productos.
 * @param {{ productoId?: string, busqueda?: string }} filtros
 */
export async function getLicencias({ productoId, busqueda } = {}) {
  let q = supabase
    .from('aut_licenses')
    .select(`
      id, license_key, cliente, tipo, duracion_dias,
      fecha_inicio, expires_at, is_active, notas, created_at, activada_en,
      productos ( id, codigo, nombre )
    `)
    .order('created_at', { ascending: false });

  if (productoId) q = q.eq('producto_id', productoId);
  if (busqueda) {
    q = q.or(`cliente.ilike.%${busqueda}%,license_key.ilike.%${busqueda}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/**
 * Crea una licencia llamando a la Edge Function create-license.
 * Requiere sesión de admin activa.
 */
export async function crearLicencia({ producto, cliente, tipo, duracion_dias, fecha_inicio, notas }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-license`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ producto, cliente, tipo, duracion_dias, fecha_inicio, notas }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json; // { license_key, id, ... }
}

/**
 * Actualiza campos permitidos de una licencia existente.
 */
export async function actualizarLicencia(id, cambios) {
  const { data, error } = await supabase
    .from('aut_licenses')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Revoca (is_active=false) o reactiva (is_active=true) una licencia.
 */
export async function toggleLicencia(id, activa) {
  return actualizarLicencia(id, { is_active: activa });
}

/**
 * Elimina definitivamente una licencia.
 */
export async function eliminarLicencia(id) {
  const { error } = await supabase.from('aut_licenses').delete().eq('id', id);
  if (error) throw error;
}

// ─── PRODUCTOS ───────────────────────────────────────────────────────────────

/**
 * Obtiene todos los productos.
 */
export async function getProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, codigo, nombre, activo, created_at')
    .order('created_at');
  if (error) throw error;
  return data;
}

/**
 * Activa o desactiva un producto.
 */
export async function toggleProducto(id, activo) {
  const { data, error } = await supabase
    .from('productos')
    .update({ activo })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Genera y descarga un CSV de las licencias actuales.
 * Usa separador ';' y BOM para compatibilidad con Excel.
 */
export function exportarCSV(licencias) {
  const cols = ['ID', 'Clave', 'Producto', 'Cliente', 'Tipo', 'Duración', 'Inicio', 'Fin', 'Activa', 'Notas'];
  const filas = licencias.map(l => [
    l.id,
    l.license_key,
    l.productos?.codigo ?? '',
    l.cliente,
    l.tipo,
    l.duracion_dias,
    l.fecha_inicio ?? '',
    l.expires_at ?? '',
    l.is_active ? 'Sí' : 'No',
    (l.notas ?? '').replace(/;/g, ','),
  ].join(';'));

  const csv = '\uFEFF' + [cols.join(';'), ...filas].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `licencias-${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
