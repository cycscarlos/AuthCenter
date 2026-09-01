# Adaptador cliente de referencia (4.2)

**Propósito:** integrar la validación de licencias de AuthCenter en un producto cliente (p. ej. AutoStock) cumpliendo D6: validar al iniciar + caché local con gracia de 72 h + revalidación cada 24 h + fail-closed en red.

Este adaptador es **agnóstico del stack**: se portó/adapta al lenguaje de cada app. Se incluye una implementación de referencia en JavaScript (browser o Node ≥ 19, que tiene `fetch` global); para otros lenguajes basta portar la lógica (`validate` + `cache` + estados).

---

## 1. Configuración

| Constante | Valor de ejemplo | Descripción |
|-----------|------------------|-------------|
| `AUTHCENTER_URL` | `https://ijvevdplnovkewxifpmf.supabase.co/functions/v1/validate-license` | Endpoint del emisor central |
| `PRODUCTO` | `AUTOSTOCK` | Código del producto en AuthCenter |
| `GRACIA_MS` | `72 * 3600 * 1000` | Período de gracia sin conexión |
| `REVALIDAR_MS` | `24 * 3600 * 1000` | Revalidación periódica |
| `LLAVE_CACHE` | `authcenter_licencia_v1` | Clave de almacenamiento local |

## 2. Caché local

```json
{
  "valida": true,
  "estado": "activa",
  "fecha_inicio": "2026-01-01",
  "expires_at": "2026-01-31",
  "dias_restantes": 15,
  "validado_en": "2026-09-01T12:00:00Z"
}
```

El campo `validado_en` (timestamp del momento de validación) no viene del servidor; lo agrega el cliente para calcular gracia y revalidación.

## 3. Implementación de referencia (JavaScript)

```js
// authcenter-cliente.js — Adaptador de validación de licencias para productos
// Compatible con browser (localStorage) y Node ≥ 19 (uso de fetch global).
const AUTHCENTER_URL = 'https://ijvevdplnovkewxifpmf.supabase.co/functions/v1/validate-license';
const PRODUCTO       = 'AUTOSTOCK';              // Ajustar por producto
const GRACIA_MS      = 72 * 3600 * 1000;          // 72 h offline sin revocar
const REVALIDAR_MS   = 24 * 3600 * 1000;          // reintento cada 24 h
const LLAVE_CACHE    = 'authcenter_licencia_v1';

function leerCache() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LLAVE_CACHE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function escribirCache(datos) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(LLAVE_CACHE, JSON.stringify(datos)); }
  catch { /* almacenamiento no disponible */ }
}

function borrarCache() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(LLAVE_CACHE); } catch { /* noop */ }
}

async function validarRemoto(licenseKey) {
  const res = await fetch(AUTHCENTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ producto: PRODUCTO, license_key: licenseKey }),
  });

  // Estados HTTP de red/fail-closed: NO son un rechazo de licencia.
  if (res.status === 429 || res.status === 500 || res.status === 503 || !res.ok) {
    return { red: true, http: res.status };
  }
  return await res.json().catch(() => ({ red: true, http: -1 }));
}

/**
 * Valida la licencia según D6.
 * @param {string} licenseKey Clave del producto.
 * @returns {Promise<{permitido: boolean, razon: string, licencia?: object}>}
 *   - permitido=true  → se puede iniciar/usar la app.
 *   - permitido=false → se bloquea (con `razon` explicativa).
 */
export async function validarLicencia(licenseKey) {
  const ahora = Date.now();

  // 1. Rechazo firme inmediato si la clave es localmente inválida (pre-filtro).
  if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){4}$/.test(licenseKey.toUpperCase())) {
    return { permitido: false, razon: 'formato_invalido' };
  }

  // 2. Llamada remota (siempre se intenta para revalidar).
  let respuesta, esRed = false;
  try {
    respuesta = await validarRemoto(licenseKey);
    if (respuesta.red) esRed = true;
  } catch {
    // Excepción de red suelta: tratar como fallo de conectividad.
    esRed = true;
    respuesta = null;
  }

  // 3. Si el servidor respondió: aplicar ESTADOS firme o activa.
  if (!esRed && respuesta) {
    if (respuesta.valida && respuesta.estado === 'activa') {
      respuesta.validado_en = new Date(ahora).toISOString();
      escribirCache(respuesta);
      return { permitido: true, razon: 'activa', licencia: respuesta };
    }
    // Estados de rechazo firme: se aplican y borran caché.
    const razonesDuras = [
      'formato_invalido', 'producto_invalido', 'producto_inactivo',
      'firma_invalida', 'desconocida', 'revocada',
      'pendiente', 'programada', 'expirada',
    ];
    if (razonesDuras.includes(respuesta.estado)) {
      borrarCache();
      return { permitido: false, razon: respuesta.estado, licencia: respuesta };
    }
  }

  // 4. Sin respuesta del servidor (red/5xx/429): aplicar política de gracia.
  const cache = leerCache();
  if (cache && cache.valida && cache.estado === 'activa') {
    const antiguedad = ahora - Date.parse(cache.validado_en);
    if (antiguedad <= GRACIA_MS) {
      // Dentro de la ventana de gracia: permitir (revalidará en el próximo arranque).
      return { permitido: true, razon: 'gracia_offline', licencia: cache };
    }
  }

  // Fuera de gracia (pasaron más de 72 h sin validar): fail-closed.
  borrarCache();
  return { permitido: false, razon: 'offline_sin_gracia' };
}

/** Forzar una revalidación (llamar al iniciar y, si se puede, en segundo plano). */
export async function revalidar(licenseKey) {
  return validarLicencia(licenseKey);
}
```

## 4. Integración en la app (patrón D6)

```js
import { validarLicencia, revalidar } from './authcenter-cliente.js';

const KEY = obtenerLicenciaGuardadaDelCliente(); // cada producto la obtiene a su forma

async function iniciarApp() {
  const resultado = await validarLicencia(KEY);
  if (!resultado.permitido) {
    // Mostrar pantalla de bloqueo con mensaje según resultado.razon
    mostrarBloqueo(resultado.razon);
    return;
  }
  continuarArranque();

  // Revalidación periódica en segundo plano (cada 24 h mínimo).
  setInterval(async () => {
    const r = await revalidar(KEY);
    if (!r.permitido) mostrarBloqueo(r.razon);
  }, REVALIDAR_MS);
}
```

## 5. Tabla de acciones por estado (resumen para el cliente)

| Estado / situación | ¿Permitido? | Acción |
|--------------------|-------------|--------|
| `activa` | ✅ Sí | Guardar caché con `validado_en`, continuar. |
| `revocada`, `expirada`, `desconocida`, `firma_invalida`, `formato_invalido`, `pendiente`, `programada` | ❌ No | Bloquear, borrar caché, mensaje según causa. |
| `producto_invalido` / `producto_inactivo` | ❌ No (bloqueo) | Bloquear y advertir de configuración; contactar admin. |
| HTTP `429`/`500`/`503`/timeout | ⏸️ Gracia | Usar caché si tiene ≤ 72 h; si no, bloquear. |
| Sin caché y sin red | ❌ No | Bloquear (`offline_sin_gracia`). |

## 6. Notas de port a otros lenguajes

- La **clave se obtiene** según cada producto (archivo de config, registro, BD local). Este adaptador recibe `licenseKey` por parámetro.
- El concepto de "caché" se adapta (localStorage, archivo, tabla interna, `Preferences`…).
- Los **rechazos duros son invariantes**: nunca otorgar gracia ante un estado firme del servidor.
- El cronograma (72 h / 24 h) es configurable por producto si el negocio lo requiere, pero por defecto es el definido en D6.