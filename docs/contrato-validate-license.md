# Contrato público — `validate-license`

**Servicio:** AuthCenter — Emisor central de licencias
**Edge Function:** [`supabase/functions/validate-license/index.ts`](../supabase/functions/validate-license/index.ts)
**Endpoint de producción:** `https://ijvevdplnovkewxifpmf.supabase.co/functions/v1/validate-license`
**Autenticación:** pública (`verify_jwt = false`). No requiere JWT.
**Versión de contrato:** 1.0 (01/09/2026)

---

## 1. Request

### 1.1 Método y cabeceras

| Campo | Valor |
|-------|-------|
| Método | `POST` |
| `Content-Type` | `application/json` |
| `Authorization` | **No requerida** |

CORS: `Access-Control-Allow-Origin: *` (válido para apps web).

### 1.2 Body

```json
{
  "producto": "AUTOSTOCK",
  "license_key": "XXXX-XXXX-XXXX-XXXX-XXXX"
}
```

| Campo | Tipo | Reglas |
|-------|------|--------|
| `producto` | string | Código del producto. Se normaliza a mayúsculas. Formato: `^[A-Z][A-Z0-9_]{1,19}$` (p. ej. `AUTOSTOCK`, `MEDSTOCK`, `POSADAS`, `GALLOSLOSINDIOS`). |
| `license_key` | string | Clave de licencia. Acepta guiones o espacios; se normaliza a 20 hex mayúsculas. Formato: `XXXX-XXXX-XXXX-XXXX-XXXX`. |

### 1.3 Ejemplo

```bash
curl -X POST https://ijvevdplnovkewxifpmf.supabase.co/functions/v1/validate-license \
  -H "Content-Type: application/json" \
  -d '{"producto":"AUTOSTOCK","license_key":"260101AB12CD34EF5678"}'
```

---

## 2. Respuesta OK (HTTP 200)

### 2.1 Estructura

```json
{
  "valida": true,
  "estado": "activa",
  "fecha_inicio": "2026-01-01",
  "expires_at": "2026-01-31",
  "dias_restantes": 15
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `valida` | boolean | `true` si la licencia está activa y válida **hoy** |
| `estado` | string | Ver lista completa en la sección 3 |
| `fecha_inicio` | string \| null | Fecha de inicio (YYYY-MM-DD, UTC) o `null` si pendiente |
| `expires_at` | string \| null | Fecha de expiración (YYYY-MM-DD, UTC) o `null` |
| `dias_restantes` | int \| null | Días restantes hasta el fin del día de expiración (mín. 0) |

La respuesta **nunca** incluye: `cliente`, `notas`, `created_by`, ni claves ajenas (diseño anti-fugas).

---

## 3. Estados de licencia

Se evalúan en este orden:

| # | estado | `valida` | Cuándo | `fecha_inicio`/`expires_at`/`dias_restantes` |
|---|--------|----------|--------|-----------------------------------------------|
| 1 | `formato_invalido` | `false` | La clave no cumple el formato de 20 hex (o no se envió) | todos `null` |
| 2 | `producto_invalido` | `false` | El código de producto no tiene formato válido, o **no existe** en la tabla `productos` | todos `null` |
| 3 | `producto_inactivo` | `false` | El producto existe pero está desactivado (`activo = false`) | todos `null` |
| 4 | `firma_invalida` | `false` | La firma HMAC de la clave no coincide con el secreto del producto | todos `null` |
| 5 | `desconocida` | `false` | La clave existe pero pertenece a otro producto, o no está en la BD | todos `null` |
| 6 | `revocada` | `false` | La licencia existe, es de este producto, pero `is_active = false` | los 3 con valores |
| 7 | `pendiente` | `false` | Licencia activa sin `fecha_inicio` aún | los 3 con valores (`fecha_inicio = null`) |
| 8 | `programada` | `false` | `fecha_inicio` es futura (`fecha_inicio > hoy`) | los 3 con valores |
| 9 | `expirada` | `false` | `expires_at` ya pasó (expiración inclusiva: vale hasta el fin del día UTC) | los 3 con valores (`dias_restantes = 0`) |
| 10 | `activa` | `true` | Todo correcto: firma válida, existe, activa, iniciada y no expirada | los 3 con valores |

> **Nota:** la expiración es **inclusiva**. Una licencia con `expires_at = 2026-01-31` es válida durante todo el 31/01 (UTC).

---

## 4. Códigos de error HTTP

| Código | Significado | Body |
|--------|-------------|------|
| `429` | Rate limit excedido (30 req/min por IP) | `{ "error": "Rate limit exceeded", "retryAfter": <segundos> }` |
| `405` | Método no permitido (solo POST) | `{ "error": "Método no permitido. Usa POST." }` |
| `503` | Servicio no disponible. **Fail-closed:** error de BD, o secreto del producto no configurado/faltante. Nunca devuelve detalles internos. | `{ "error": "Servicio de validación no disponible" }` |
| `500` | Error interno inesperado | `{ "error": "Error interno" }` |

> ⚠️ **Regla de oro para clientes:** `500` y `503` NO significan que la licencia sea inválida. El cliente debe aplicar la **política de gracia offline** (sección 6), no revocar.

---

## 5. Rate limit

| Parámetro | Valor |
|-----------|-------|
| Ventana | 60 segundos |
| Máximo | **30 requests por IP** |
| Responses | Incluye `X-RateLimit-Remaining` y `X-RateLimit-RetryAfter` |

Diseño anti enumeración de claves (fuerza bruta). El identifcador es la IP (prioridad: `X-Forwarded-For` → `X-Real-IP`).

---

## 6. Política de gracia offline (D6) — requisito para CLIENTES

El cliente NO debe asumir que AuthCenter estará siempre disponible (punto único de falla). Reglas:

1. **Al iniciar la app:** validar la licencia contra AuthCenter.
2. **En caso de red/HTTP 5xx/429:** NO revocar la licencia. Usar la **caché local**:
   - Si ya existe una validación previa con `valida: true` y no han pasado más de **72 horas**, se considera licencia válida (período de gracia).
   - Si pasaron más de 72 h sin poder validar, **bloquear** (fail-closed).
3. **Revalidación:** reintentar cada **24 horas** aunque la caché sea válida (para no acostumbrarse a una red caída).
4. **Respuestas de rechazo firme** (`formato_invalido`, `producto_invalido`, `producto_inactivo`, `firma_invalida`, `desconocida`, `revocada`, `pendiente`, `programada`, `expirada`) se aplican **inmediatamente y sobreescriben** la caché.

> La gracia de 72 h mitiga el punto único de falla sin comprometer la seguridad: acortar rechazos nunca es posible, solo se difiere la verificación.

---

## 7. Compatibilidad de estados (cliente)

| `estado` recibido | Acción del cliente |
|-------------------|--------------------|
| `activa` | Habilitar funcionalidad. Guardar en caché con timestamp. |
| `expirada` / `programada` / `pendiente` | Bloquear, mostrar mensaje según caso. Borrar caché. |
| `revocada` | Bloquear inmediatamente. Borrar caché. |
| `firma_invalida` / `desconocida` / `formato_invalido` | No es una licencia válida del producto. Bloquear. |
| `producto_invalido` / `producto_inactivo` | Configuración incorrecta del producto en el centro. Bloquear (según negocio) y contactar al administrador. |
| HTTP `429`, `500`, `503`, tiempo de espera | Usar política de gracia offline (sección 6). |

---

## 8. Cambios y versionado

- Este contrato es estable; el agregado de estados nuevos es **aditivo** (los clientes deben tolerar estados desconocidos → tratar como rechazo firme).
- La rotación de secretos del producto invalida las claves emitidas con el secreto anterior ⇒ reemisión planificada (ver plan maestro, sección 5.2).