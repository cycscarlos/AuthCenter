// src/lib/auth.js — Gestión de sesión y guard de admin
import { supabase } from './supabase.js';

/**
 * Devuelve el usuario activo, o null si no hay sesión.
 */
export async function getUsuario() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Verifica que el usuario en sesión tiene rol 'admin' en user_metadata.
 * La seguridad real está en RLS y en las Edge Functions;
 * esta verificación es solo para UX (ocultar/mostrar UI).
 */
export function esAdmin(user) {
  return user?.user_metadata?.rol === 'admin';
}

/**
 * Guard: si no hay sesión o no es admin, redirige a login.
 * Usar al inicio de cada página protegida.
 */
export async function requireAdmin() {
  const user = await getUsuario();
  if (!user || !esAdmin(user)) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

/**
 * Login con email + password.
 * @returns {{ user, error }}
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, error };
}

/**
 * Cierra sesión y redirige a login.
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/index.html';
}
