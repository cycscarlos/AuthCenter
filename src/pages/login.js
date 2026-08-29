// src/pages/login.js — Lógica de la página de acceso
import '../style.css';
import { login, getUsuario, esAdmin } from '../lib/auth.js';

// Si ya hay sesión activa de admin → redirigir al panel
(async () => {
  const user = await getUsuario();
  if (user && esAdmin(user)) {
    window.location.href = '/panel/licencias.html';
  }
})();

const form     = document.getElementById('login-form');
const btnLogin = document.getElementById('btn-login');
const errEl    = document.getElementById('login-error');

function mostrarError(msg) {
  errEl.textContent = msg;
  errEl.classList.add('visible');
}
function limpiarError() {
  errEl.classList.remove('visible');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarError();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    mostrarError('Completa todos los campos.');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Verificando…';

  const { user, error } = await login(email, password);

  if (error || !user) {
    console.error('Error al iniciar sesión:', error);
    mostrarError(error?.message || 'Credenciales incorrectas o sin acceso.');
    btnLogin.disabled = false;
    btnLogin.textContent = 'Iniciar sesión';
    return;
  }

  if (!esAdmin(user)) {
    mostrarError('Tu cuenta no tiene permisos de administrador.');
    btnLogin.disabled = false;
    btnLogin.textContent = 'Iniciar sesión';
    return;
  }

  window.location.href = '/panel/licencias.html';
});
