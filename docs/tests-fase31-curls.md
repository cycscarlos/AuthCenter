# Pruebas End-to-End (Fase 3.1) — Creación y Validación de Licencias

**Proyecto Supabase REF:** `ijvevdplnovkewxifpmf`  
**Base URL:** `https://ijvevdplnovkewxifpmf.supabase.co`

---

## Prerequisitos

Debes tener a la mano:
1. Tu **ANON KEY** de Supabase AuthCenter (Dashboard → Project Settings → API).
2. Tu contraseña del usuario administrador (`alchemy.zcoder@gmail.com`).

---

## Comandos PowerShell para ejecutar las pruebas

Abre PowerShell en tu terminal y ejecuta paso a paso:

### Paso 1: Definir variables iniciales
```powershell
$BASE    = "https://ijvevdplnovkewxifpmf.supabase.co"
$ANON    = "TU_SUPABASE_ANON_KEY_AQUI"
$EMAIL   = "alchemy.zcoder@gmail.com"
$PASS    = "TU_CONTRASEÑA_ADMIN_AQUI"
```

### Paso 2: Obtener el JWT de Administrador (Login)
```powershell
$res = Invoke-RestMethod `
  -Method POST `
  -Uri "$BASE/auth/v1/token?grant_type=password" `
  -Headers @{ "apikey" = $ANON; "Content-Type" = "application/json" } `
  -Body (@{ email = $EMAIL; password = $PASS } | ConvertTo-Json)

$JWT = $res.access_token
Write-Host "JWT de Admin obtenido correctamente: $($JWT.Substring(0,30))..."
```

### Paso 3: Emitir una Licencia para AUTOSTOCK (`create-license`)
```powershell
$bodyCreate = @{
  producto      = "AUTOSTOCK"
  cliente       = "ClientePruebaAuto"
  tipo          = "demo"
  duracion_dias = 30
} | ConvertTo-Json

$lic = Invoke-RestMethod `
  -Method POST `
  -Uri "$BASE/functions/v1/create-license" `
  -Headers @{ "Authorization" = "Bearer $JWT"; "Content-Type" = "application/json" } `
  -Body $bodyCreate

$KEY = $lic.license_key
Write-Host "Licencia generada exitosamente: $KEY"
```

### Paso 4: Validar la Licencia Generada (`validate-license`) — Debe responder `activa`
```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "$BASE/functions/v1/validate-license" `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body (@{ producto = "AUTOSTOCK"; license_key = $KEY } | ConvertTo-Json)
```
**Resultado Esperado:**
```json
{
  "valida": true,
  "estado": "activa",
  "fecha_inicio": "2026-08-28",
  "expires_at": "2026-09-26",
  "dias_restantes": 30
}
```

### Paso 5: Validar la misma Licencia usando MEDSTOCK — Debe rechazar por firma/producto ajeno
```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "$BASE/functions/v1/validate-license" `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body (@{ producto = "MEDSTOCK"; license_key = $KEY } | ConvertTo-Json)
```
**Resultado Esperado:**
```json
{
  "valida": false,
  "estado": "firma_invalida"
}
```
*(Firma inválida porque la clave fue emitida con el secreto de AUTOSTOCK y no el de MEDSTOCK).*
