// src/pages/licencias.js — Lógica del panel de licencias
import '../style.css';
import { requireAdmin, logout } from '../lib/auth.js';
import {
  getLicencias, crearLicencia, actualizarLicencia,
  toggleLicencia, eliminarLicencia, getProductos, exportarCSV,
} from '../lib/api.js';
import { esc, fmtFecha, chipEstado } from '../lib/escape.js';

// ── Guard ─────────────────────────────────────────────────
const user = await requireAdmin();
if (!user) throw new Error('Sin sesión');

document.getElementById('topbar-email').textContent = user.email;
document.getElementById('btn-logout').addEventListener('click', logout);

// ── Estado ────────────────────────────────────────────────
let todasLicencias = [];
let productos      = [];
let editandoId     = null;

// ── Init ──────────────────────────────────────────────────
await Promise.all([cargarProductos(), cargarLicencias()]);

// ── Carga productos ───────────────────────────────────────
async function cargarProductos() {
  try {
    productos = await getProductos();
    const filtroSel = document.getElementById('filtro-producto');
    const licProdSel = document.getElementById('lic-producto');

    productos.forEach(p => {
      filtroSel.insertAdjacentHTML('beforeend',
        `<option value="${esc(p.id)}">${esc(p.codigo)} — ${esc(p.nombre)}</option>`);
      if (p.activo) {
        licProdSel.insertAdjacentHTML('beforeend',
          `<option value="${esc(p.codigo)}">${esc(p.codigo)} — ${esc(p.nombre)}</option>`);
      }
    });
  } catch (err) {
    toast(`Error cargando productos: ${err.message}`, 'error');
  }
}

// ── Carga licencias ───────────────────────────────────────
async function cargarLicencias() {
  try {
    const productoId = document.getElementById('filtro-producto').value;
    const busqueda   = document.getElementById('filtro-busqueda').value.trim();
    todasLicencias   = await getLicencias({ productoId: productoId || undefined, busqueda: busqueda || undefined });
    renderTabla();
    renderStats();
  } catch (err) {
    toast(`Error cargando licencias: ${err.message}`, 'error');
  }
}

// ── Render tabla ──────────────────────────────────────────
function renderTabla() {
  const tbody = document.getElementById('tabla-body');
  document.getElementById('total-badge').textContent =
    `${todasLicencias.length} resultado${todasLicencias.length !== 1 ? 's' : ''}`;

  if (!todasLicencias.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Sin licencias para mostrar.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = todasLicencias.map(l => {
    const { label, cls } = chipEstado(l);
    const off = !l.is_active || chipEstado(l).cls === 'chip--expirada';

    const hoy = new Date().toISOString().slice(0, 10);
    let dias = '—';
    if (l.expires_at && l.fecha_inicio && l.fecha_inicio <= hoy) {
      const d = Math.ceil((Date.parse(`${l.expires_at}T23:59:59Z`) - Date.now()) / 86400000);
      dias = d > 0 ? d : 0;
    }

    return `<tr class="${off ? 'row--off' : ''}" data-id="${esc(l.id)}">
      <td><span class="chip ${cls}">${label}</span></td>
      <td>
        <span class="license-key" data-key="${esc(l.license_key)}" title="Clic para copiar">
          ${esc(l.license_key)}
          <svg class="license-key__icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </span>
      </td>
      <td class="truncate" style="max-width:160px;" title="${esc(l.cliente)}">${esc(l.cliente)}</td>
      <td><span style="font-size:.78rem;font-family:monospace;color:var(--text-secondary)">${esc(l.productos?.codigo ?? '—')}</span></td>
      <td style="text-transform:capitalize">${esc(l.tipo)}</td>
      <td>${fmtFecha(l.fecha_inicio)}</td>
      <td>${fmtFecha(l.expires_at)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${dias}</td>
      <td>
        <div style="display:flex;gap:.3rem;justify-content:flex-end">
          <button class="btn btn--ghost btn--sm btn-editar" data-id="${esc(l.id)}" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${l.is_active
            ? `<button class="btn btn--ghost btn--sm btn-revocar" data-id="${esc(l.id)}" title="Revocar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
               </button>`
            : `<button class="btn btn--ghost btn--sm btn-reactivar" data-id="${esc(l.id)}" title="Reactivar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>
               </button>`
          }
          <button class="btn btn--danger btn--sm btn-eliminar" data-id="${esc(l.id)}" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Render stats ──────────────────────────────────────────
function renderStats() {
  const hoy = new Date().toISOString().slice(0, 10);
  let activas = 0, expiran7 = 0, pendientes = 0, expiradas = 0;

  todasLicencias.forEach(l => {
    const { cls } = chipEstado(l);
    if (cls === 'chip--activa') activas++;
    else if (cls === 'chip--por-expirar') { activas++; expiran7++; }
    else if (cls === 'chip--pendiente' || cls === 'chip--programada') pendientes++;
    else if (cls === 'chip--expirada') expiradas++;
  });

  document.getElementById('stat-activas').textContent   = activas;
  document.getElementById('stat-expiran').textContent   = expiran7;
  document.getElementById('stat-pendientes').textContent = pendientes;
  document.getElementById('stat-expiradas').textContent = expiradas;
}

// ── Eventos tabla ─────────────────────────────────────────
document.getElementById('tabla-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  const keyEl = e.target.closest('.license-key');

  // Copiar clave
  if (keyEl) {
    const key = keyEl.dataset.key;
    await navigator.clipboard.writeText(key);
    toast('Clave copiada al portapapeles', 'ok');
    return;
  }

  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.classList.contains('btn-editar')) {
    const lic = todasLicencias.find(l => String(l.id) === String(id));
    if (lic) abrirModalEditar(lic);
  }

  if (btn.classList.contains('btn-revocar')) {
    if (!confirm('¿Revocar esta licencia? El cliente perderá acceso.')) return;
    try {
      await toggleLicencia(id, false);
      toast('Licencia revocada', 'ok');
      await cargarLicencias();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (btn.classList.contains('btn-reactivar')) {
    try {
      await toggleLicencia(id, true);
      toast('Licencia reactivada', 'ok');
      await cargarLicencias();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (btn.classList.contains('btn-eliminar')) {
    const lic = todasLicencias.find(l => String(l.id) === String(id));
    if (!confirm(`¿Eliminar definitivamente la licencia de "${lic?.cliente}"? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarLicencia(id);
      toast('Licencia eliminada', 'ok');
      await cargarLicencias();
    } catch (err) { toast(err.message, 'error'); }
  }
});

// ── Filtros ───────────────────────────────────────────────
let debounceTimer;
document.getElementById('filtro-busqueda').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(cargarLicencias, 350);
});
document.getElementById('filtro-producto').addEventListener('change', cargarLicencias);

// ── Exportar ──────────────────────────────────────────────
document.getElementById('btn-exportar').addEventListener('click', () => {
  exportarCSV(todasLicencias);
});

// ── Modal ─────────────────────────────────────────────────
const backdrop   = document.getElementById('modal-backdrop');
const formLic    = document.getElementById('form-licencia');
const modalTitle = document.getElementById('modal-title');
const btnGuardar = document.getElementById('btn-guardar');
const modalError = document.getElementById('modal-error');
const inputInicio = document.getElementById('lic-inicio');
const inputDuracion = document.getElementById('lic-duracion');
const inputFinCalc  = document.getElementById('lic-fin-calc');
const groupFin      = document.getElementById('group-fin');

function calcularFechaFin() {
  const inicio   = inputInicio.value;
  const duracion = parseInt(inputDuracion.value, 10);
  if (inicio && duracion > 0) {
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + duracion - 1);
    inputFinCalc.value = fin.toISOString().slice(0, 10);
    groupFin.style.display = '';
  } else {
    groupFin.style.display = 'none';
  }
}
inputInicio.addEventListener('input', calcularFechaFin);
inputDuracion.addEventListener('input', calcularFechaFin);

function abrirModalCrear() {
  editandoId = null;
  modalTitle.textContent = 'Nueva licencia';
  btnGuardar.textContent = 'Crear licencia';
  formLic.reset();
  modalError.classList.remove('visible');
  groupFin.style.display = 'none';
  backdrop.classList.add('open');
  document.getElementById('lic-cliente').focus();
}

function abrirModalEditar(lic) {
  editandoId = lic.id;
  modalTitle.textContent = 'Editar licencia';
  btnGuardar.textContent = 'Guardar cambios';
  modalError.classList.remove('visible');

  document.getElementById('lic-id').value       = lic.id;
  document.getElementById('lic-tipo').value     = lic.tipo;
  document.getElementById('lic-cliente').value  = lic.cliente;
  document.getElementById('lic-duracion').value = lic.duracion_dias;
  document.getElementById('lic-inicio').value   = lic.fecha_inicio ?? '';
  document.getElementById('lic-notas').value    = lic.notas ?? '';
  // producto: solo lectura al editar
  const prodSel = document.getElementById('lic-producto');
  prodSel.value = lic.productos?.codigo ?? '';
  prodSel.disabled = true;

  calcularFechaFin();
  backdrop.classList.add('open');
}

function cerrarModal() {
  backdrop.classList.remove('open');
  document.getElementById('lic-producto').disabled = false;
}

document.getElementById('btn-nueva').addEventListener('click', abrirModalCrear);
document.getElementById('modal-close').addEventListener('click', cerrarModal);
document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
backdrop.addEventListener('click', e => { if (e.target === backdrop) cerrarModal(); });

// ── Submit form ───────────────────────────────────────────
formLic.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalError.classList.remove('visible');

  const producto    = document.getElementById('lic-producto').value;
  const cliente     = document.getElementById('lic-cliente').value.trim();
  const tipo        = document.getElementById('lic-tipo').value;
  const duracion    = parseInt(document.getElementById('lic-duracion').value, 10);
  const fecha_inicio = document.getElementById('lic-inicio').value || null;
  const notas       = document.getElementById('lic-notas').value.trim() || null;

  if (!producto || !cliente || !tipo || !duracion) {
    modalError.textContent = 'Completa los campos obligatorios.';
    modalError.classList.add('visible');
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = editandoId ? 'Guardando…' : 'Creando…';

  try {
    if (editandoId) {
      await actualizarLicencia(editandoId, {
        cliente, tipo, duracion_dias: duracion, fecha_inicio, notas,
      });
      toast('Licencia actualizada', 'ok');
    } else {
      const res = await crearLicencia({ producto, cliente, tipo, duracion_dias: duracion, fecha_inicio, notas });
      const claveEmitida = res.license_key || res.licencia?.license_key || '';
      toast(`Licencia creada: ${claveEmitida}`, 'ok');
    }
    cerrarModal();
    await cargarLicencias();
  } catch (err) {
    modalError.textContent = err.message;
    modalError.classList.add('visible');
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = editandoId ? 'Guardar cambios' : 'Crear licencia';
  }
});

// ── Toast ─────────────────────────────────────────────────
function toast(msg, tipo = 'ok') {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
