// src/pages/productos.js — Lógica del panel de productos
import '../style.css';
import { requireAdmin, logout } from '../lib/auth.js';
import { getProductos, toggleProducto } from '../lib/api.js';
import { esc, fmtFecha } from '../lib/escape.js';

// ── Guard ─────────────────────────────────────────────────
const user = await requireAdmin();
if (!user) throw new Error('Sin sesión');

document.getElementById('topbar-email').textContent = user.email;
document.getElementById('btn-logout').addEventListener('click', logout);

// ── Carga y render ────────────────────────────────────────
async function cargarProductos() {
  try {
    const productos = await getProductos();
    renderTabla(productos);
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

function renderTabla(productos) {
  const tbody = document.getElementById('tabla-body');

  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">No hay productos registrados.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map(p => `
    <tr class="${p.activo ? '' : 'row--off'}" data-id="${esc(p.id)}">
      <td>
        <span class="chip ${p.activo ? 'chip--activa' : 'chip--revocada'}">
          ${p.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <span style="font-family:monospace;font-size:.85rem;color:var(--gold-300)">
          ${esc(p.codigo)}
        </span>
      </td>
      <td>${esc(p.nombre)}</td>
      <td style="color:var(--text-muted);font-size:.82rem">${fmtFecha(p.created_at?.slice(0,10))}</td>
      <td>
        <div style="display:flex;justify-content:flex-end;">
          <button
            class="btn btn--ghost btn--sm btn-toggle"
            data-id="${esc(p.id)}"
            data-activo="${p.activo}"
            title="${p.activo ? 'Desactivar producto' : 'Activar producto'}"
          >
            ${p.activo
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> Desactivar`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg> Activar`
            }
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Toggle activo ─────────────────────────────────────────
document.getElementById('tabla-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-toggle');
  if (!btn) return;

  const id     = btn.dataset.id;
  const activo = btn.dataset.activo === 'true';
  const accion = activo ? 'desactivar' : 'activar';

  if (!confirm(`¿Quieres ${accion} este producto? ${activo ? 'Las licencias existentes seguirán siendo validables hasta que expiren.' : ''}`)) return;

  btn.disabled = true;
  try {
    await toggleProducto(id, !activo);
    toast(`Producto ${accion === 'activar' ? 'activado' : 'desactivado'}`, 'ok');
    await cargarProductos();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
    btn.disabled = false;
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

// ── Init ──────────────────────────────────────────────────
await cargarProductos();
