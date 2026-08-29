# Guía Maestro y Paso a Paso para el Usuario — AuthCenter

**Fecha:** 28 de Agosto, 2026  
**Proyecto:** AuthCenter (Emisor Central de Licencias)  
**Ref Supabase:** `ijvevdplnovkewxifpmf`  

---

## 1. ¿Qué se ha hecho hasta el momento? (Resumen de Cambios)

El asistente construyó e integró los componentes principales de AuthCenter:

1. **Base de Datos (Supabase):**
   - Tablas `productos`, `usuarios` (admins), `aut_licenses`, `rate_limits` creadas.
   - Usuario administrador `alchemy.zcoder@gmail.com` registrado y asignado con rol `admin`.
   - Políticas RLS (Row Level Security) activas para bloquear accesos anónimos a `aut_licenses`.

2. **Backend & Edge Functions (Supabase Functions):**
   - Edge Function `create-license` (creación de licencias protegida con HMAC y verificación de rol admin).
   - Edge Function `validate-license` (validación pública multi-producto con rate limiting y verificación HMAC timing-safe).
   - Secretos `LICENSE_SECRET_AUTOSTOCK`, `LICENSE_SECRET_MEDSTOCK`, `LICENSE_SECRET_POSADAS` configurados.

3. **Frontend / Panel Admin Standalone (Vite + Vanilla JS + Modern CSS):**
   - Proyecto estructurado en Vite multi-página (`index.html` para Login, `/panel/licencias.html` para Licencias, `/panel/productos.html` para Productos).
   - Sistema de diseño CSS moderno (tema oscuro elegante con acentos en dorado ámbar, tipografía Sora + DM Sans, badges de estado, animaciones y diseño responsivo).
   - Capa de datos en `src/lib/` (`supabase.js`, `auth.js`, `api.js`, `escape.js`).
   - Funcionalidades listas: Login de admin, tabla de licencias con filtros y búsqueda, creación/edición de licencias, revocación/reactivación, copia de claves al portapapeles, exportación a CSV con formato Excel BOM, y gestión de estado de productos.
   - Configuración de seguridad para Vercel en `vercel.json` con cabeceras de Content Security Policy (CSP).
   - **Verificación de build:** Se ejecutó `npm run build` obteniendo una compilación 100% limpia sin errores en `dist/`.

---

## 2. Matriz de Estado del Proyecto

| Componente | Estado | Detalle |
| :--- | :---: | :--- |
| **BD & Schemas SQL** | ✅ Completado | Tablas y RLS en AuthCenter. |
| **Edge Functions (`create-license`, `validate-license`)** | ✅ Desplegadas | Operativas en Supabase (`https://ijvevdplnovkewxifpmf.supabase.co`). |
| **Panel Admin (Código)** | ✅ Completado | Estructura Vite multi-página compilada y verificada. |
| **Paso 1: `.env` Local** | ⏳ Pendiente (Tú) | Colocar la `VITE_SUPABASE_ANON_KEY` real. |
| **Paso 2: Test de Panel Local** | ⏳ Pendiente (Tú) | Probar `npm run dev` en tu navegador. |
| **Paso 3: Test E2E Edge Functions** | ⏳ Pendiente (Tú) | Probar emisión y validación vía PowerShell. |
| **Paso 4: Script SQL 06 (Gallos)** | ⏳ Pendiente (Tú) | Ejecutar script 06 en Supabase Dashboard. |
| **Paso 5: Secreto Gallos** | ⏳ Pendiente (Tú) | Agregar `LICENSE_SECRET_GALLOSLOSINDIOS` en Supabase Dashboard. |
| **Paso 6: Deploy en Vercel** | ⏳ Pendiente (Tú) | Desplegar la app del panel admin en Vercel. |

---

## 3. Plan Paso a Paso de lo que DEBES Hacer

Sigue estos 6 pasos concretos para validar y poner en marcha AuthCenter:

---

### PASO 1: Configurar tu archivo `.env` local

1. Abre el archivo `.env` en la raíz del proyecto AuthCenter.
2. Copia tu **Anon Key** desde el Dashboard de Supabase (*Project Settings → API → anon / public*).
3. Reemplaza el valor en `.env`:
   ```env
   VITE_SUPABASE_URL=https://ijvevdplnovkewxifpmf.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key_real_aqui
   ```

---

### PASO 2: Iniciar y Probar el Panel Admin Localmente

1. En tu terminal de PowerShell dentro de esta carpeta, ejecuta:
   ```powershell
   npm run dev
   ```
2. Abre tu navegador en `http://localhost:3000`.
3. Inicia sesión con tus credenciales de admin:
   - **Correo:** `alchemy.zcoder@gmail.com`
   - **Contraseña:** Tu contraseña de Supabase
4. Prueba la interfaz:
   - Revisa la vista de **Licencias** y los stat-cards.
   - Crea una nueva licencia para `AUTOSTOCK`.
   - Haz clic en la clave emitida para copiarla al portapapeles.
   - Navega a la vista de **Productos** y verifica la lista de productos activos.

---

### PASO 3: Probar la API de Licencias (Tests End-to-End)

Si deseas probar la emisión y validación directamente desde la terminal mediante PowerShell:
1. Abre el archivo [`docs/tests-fase31-curls.md`](file:///c:/Users/zcoder/Documents/CYCSWeb/GitHub/0-Vercel/AuthCenter/docs/tests-fase31-curls.md).
2. Ejecuta los comandos numerados del 1 al 5 en PowerShell.
3. Verifica que la validación responda `{"valida": true, "estado": "activa"}`.

---

### PASO 4: Registrar "Gallos los Indios" como 4to Producto (SQL)

1. Ingresa al [Dashboard de Supabase](https://supabase.com/dashboard/project/ijvevdplnovkewxifpmf).
2. **VERIFICA** en la parte superior que el proyecto seleccionado sea **AuthCenter** (`ijvevdplnovkewxifpmf`).
3. Ve a **SQL Editor** → **New Query**.
4. Abre y copia el contenido del script [`scripts/06-galloslosindios-producto.sql`](file:///c:/Users/zcoder/Documents/CYCSWeb/GitHub/0-Vercel/AuthCenter/scripts/06-galloslosindios-producto.sql).
5. Haz clic en **Run**.

---

### PASO 5: Configurar el Secreto para Gallos los Indios

1. En el Dashboard de Supabase de AuthCenter, ve a **Project Settings** → **Edge Functions** (o **Secrets**).
2. Agrega un nuevo secreto:
   - **Name:** `LICENSE_SECRET_GALLOSLOSINDIOS`
   - **Value:** Una cadena aleatoria segura de al menos 32 caracteres (o 64 caracteres en hexadecimal).

---

### PASO 6: Desplegar el Panel de Administración en Vercel

1. Sube los cambios a tu repositorio de GitHub (o conéctalo a Vercel).
2. En Vercel, crea un **Nuevo Proyecto** importando el repositorio `AuthCenter`.
3. Configura las **Environment Variables** en Vercel:
   - `VITE_SUPABASE_URL` = `https://ijvevdplnovkewxifpmf.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `tu_anon_key_real`
4. Haz clic en **Deploy**.

---

## 4. Archivos Principales de Referencia

- 📘 **Plan Maestro Original:** [`docs/plan-emisor-central-licencias.md`](file:///c:/Users/zcoder/Documents/CYCSWeb/GitHub/0-Vercel/AuthCenter/docs/plan-emisor-central-licencias.md)
- 🧪 **Guía de Pruebas API / PowerShell:** [`docs/tests-fase31-curls.md`](file:///c:/Users/zcoder/Documents/CYCSWeb/GitHub/0-Vercel/AuthCenter/docs/tests-fase31-curls.md)
- 🗄️ **Script SQL Gallos:** [`scripts/06-galloslosindios-producto.sql`](file:///c:/Users/zcoder/Documents/CYCSWeb/GitHub/0-Vercel/AuthCenter/scripts/06-galloslosindios-producto.sql)
- ⚙️ **Configuración Vercel:** [`vercel.json`](file:///c:/Users/zcoder/Documents/CYCSWeb/GitHub/0-Vercel/AuthCenter/vercel.json)
