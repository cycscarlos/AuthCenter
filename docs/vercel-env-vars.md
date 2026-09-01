# Configuración de Variables de Entorno en Vercel — AuthCenter

## Variables necesarias

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://ijvevdplnovkewxifpmf.supabase.co` | URL del proyecto Supabase AuthCenter |
| `VITE_SUPABASE_ANON_KEY` | *(obtener del Dashboard Supabase)* | Clave pública (anon) de Supabase |

## Pasos para configurar

### Paso 1: Obtener la anon key

1. Abrir el **Dashboard de Supabase**: https://supabase.com/dashboard
2. Seleccionar el proyecto **AuthCenter** (org `alchemy`)
3. Ir a **Settings** → **API**
4. Copiar el valor de **`anon` / `public` key**

### Paso 2: Configurar en Vercel

1. Abrir **Vercel**: https://vercel.com
2. Seleccionar el proyecto **AuthCenter**
3. Ir a **Settings** → **Environment Variables**
4. Agregar cada variable:

**Variable 1:**
- Name: `VITE_SUPABASE_URL`
- Value: `https://ijvevdplnovkewxifpmf.supabase.co`
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **Add**

**Variable 2:**
- Name: `VITE_SUPABASE_ANON_KEY`
- Value: *(pegar la anon key copiada en Paso 1)*
- Environments: ✅ Production ✅ Preview ✅ Development
- Click **Add**

### Paso 3: Redesplegar

1. Ir a la pestaña **Deployments** del proyecto en Vercel
2. Hacer click en los **3 puntos** del deployment más reciente
3. Seleccionar **Redeploy**
4. Confirmar el redeploy

### Paso 4: Verificar

1. Abrir la URL de Vercel asignada al proyecto
2. Hacer login con credenciales de admin
3. Crear una licencia de prueba desde el panel
4. Verificar que la licencia se crea correctamente

## Troubleshooting

| Problema | Solución |
|----------|----------|
| "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY" | Verificar que las env vars estén configuradas y que se haya redeployed |
| Login no funciona | Verificar que la anon key sea correcta y que el usuario tenga rol `admin` en la tabla `usuarios` |
| Panel carga pero no muestra datos | Verificar que `VITE_SUPABASE_URL` apunte al proyecto correcto |
