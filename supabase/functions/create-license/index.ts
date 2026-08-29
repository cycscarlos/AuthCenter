// create-license - Emisión de claves de licencia (SOLO rol admin del centro)
//
// verify_jwt=false en config.toml, pero la función exige JWT válido y rol
// 'admin' verificado CONTRA la tabla usuarios (SERVICE_ROLE) — patrón Gallos.
// Secreto HMAC por producto (D4): LICENSE_SECRET_<CODIGO>.
// El body DEBE incluir "producto" (codigo de la tabla productos, p. ej.
// "AUTOSTOCK"); el producto debe existir y estar activo.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getIdentifier, RATE_LIMIT_CONFIGS } from "../_shared/rate-limit.ts";
import {
  checkDistributedRateLimit,
  getRateLimitHeaders,
} from "../_shared/distributed-rate-limit.ts";
import { sanitizeText, sanitizeInteger } from "../_shared/sanitize.ts";
import {
  generateLicenseKey,
  getLicenseSecret,
  PRODUCTO_RE,
} from "../_shared/license-keys.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIPOS_VALIDOS = ["demo", "prueba", "licencia"];

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonError(
  message: string,
  status: number,
  rateLimitHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, ...rateLimitHeaders },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limiting distribuido (máx 5 emisiones por minuto por IP/usuario)
    const identifier = getIdentifier(req);
    const rateLimit = await checkDistributedRateLimit(
      supabaseAdmin,
      identifier,
      RATE_LIMIT_CONFIGS.create.maxRequests,
      Math.round(RATE_LIMIT_CONFIGS.create.windowMs / 1000)
    );
    const rateLimitHeaders = getRateLimitHeaders(
      rateLimit.remaining,
      rateLimit.retryAfter
    );

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimit.retryAfter,
        }),
        { headers: { ...corsHeaders, ...rateLimitHeaders }, status: 429 }
      );
    }

    // Autenticación obligatoria: verificar el JWT del llamador
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonError("Authorization header required", 401, rateLimitHeaders);
    }

    let jwtPayload: { sub?: string; exp?: number } | null = null;
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        jwtPayload = JSON.parse(atob(base64));
      }
    } catch {
      jwtPayload = null;
    }

    if (!jwtPayload || !jwtPayload.sub) {
      return jsonError("Token de autenticación inválido", 401, rateLimitHeaders);
    }

    if (jwtPayload.exp && jwtPayload.exp < Math.floor(Date.now() / 1000)) {
      return jsonError("Token expirado", 401, rateLimitHeaders);
    }

    const callerId = jwtPayload.sub;

    // Autorización: solo administradores activos del centro pueden emitir licencias
    const { data: callerData, error: callerError } = await supabaseAdmin
      .from("usuarios")
      .select("rol, activo")
      .eq("id", callerId)
      .maybeSingle();

    if (callerError || !callerData || callerData.rol !== "admin" || !callerData.activo) {
      return jsonError(
        "No tienes permisos para emitir licencias",
        403,
        rateLimitHeaders
      );
    }

    // Validación del body
    const body = await req.json();

    // Producto obligatorio: debe existir y estar activo
    const productoCodigo =
      typeof body?.producto === "string"
        ? body.producto.trim().toUpperCase()
        : "";
    if (!PRODUCTO_RE.test(productoCodigo)) {
      return jsonError(
        "El campo 'producto' es obligatorio (codigo valido, p. ej. AUTOSTOCK)",
        400,
        rateLimitHeaders
      );
    }

    const { data: producto, error: productoError } = await supabaseAdmin
      .from("productos")
      .select("id, activo")
      .eq("codigo", productoCodigo)
      .maybeSingle();

    if (productoError) {
      console.error("Error consultando productos:", productoError.message);
      return jsonError("Error validando el producto", 500, rateLimitHeaders);
    }
    if (!producto) {
      return jsonError("Producto no válido", 400, rateLimitHeaders);
    }
    if (!producto.activo) {
      return jsonError("Producto inactivo", 400, rateLimitHeaders);
    }

    // Secreto HMAC del producto (error genérico 500 si falta; sin detalles)
    let secret: string;
    try {
      secret = getLicenseSecret(productoCodigo);
    } catch (_err) {
      console.error(`LICENSE_SECRET_${productoCodigo} no configurada`);
      return jsonError(
        "Servidor sin configurar para emisión de licencias",
        500,
        rateLimitHeaders
      );
    }

    const tipo = TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : "prueba";

    const duracionDias = sanitizeInteger(body.duracion_dias, 1, 365);
    if (duracionDias === null) {
      return jsonError(
        "La duración debe ser un entero entre 1 y 365 días",
        400,
        rateLimitHeaders
      );
    }

    let cliente: string | null = null;
    if (body.cliente !== undefined && body.cliente !== null && body.cliente !== "") {
      cliente = sanitizeText(String(body.cliente));
      if (!cliente || cliente.length > 120) {
        return jsonError("El nombre del cliente no es válido", 400, rateLimitHeaders);
      }
    }

    let notas: string | null = null;
    if (body.notas !== undefined && body.notas !== null && body.notas !== "") {
      notas = sanitizeText(String(body.notas));
      if (!notas || notas.length > 500) {
        return jsonError("Las notas no son válidas (máx 500)", 400, rateLimitHeaders);
      }
    }

    // Fecha de inicio opcional (el admin puede dejarla pendiente)
    let fechaInicio: string | null = null;
    if (body.fecha_inicio !== undefined && body.fecha_inicio !== null && body.fecha_inicio !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha_inicio))) {
        return jsonError("fecha_inicio debe tener formato YYYY-MM-DD", 400, rateLimitHeaders);
      }
      fechaInicio = String(body.fecha_inicio);
    }

    // Si hay fecha de inicio, expires_at = inicio + duracion - 1 (día final inclusivo, UTC)
    let expiresAt: string | null = null;
    if (fechaInicio) {
      const ms = Date.parse(`${fechaInicio}T00:00:00Z`);
      if (Number.isNaN(ms)) {
        return jsonError("fecha_inicio no es una fecha válida", 400, rateLimitHeaders);
      }
      expiresAt = new Date(ms + (duracionDias - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
    }

    // Generación con reintento ante colisión UNIQUE (improbable: serial aleatorio)
    let licencia: Record<string, unknown> | null = null;
    let ultimoError: { message: string; code?: string } | null = null;

    for (let intento = 0; intento < 5; intento++) {
      const licenseKey = await generateLicenseKey(new Date(), secret);

      const { data, error } = await supabaseAdmin
        .from("aut_licenses")
        .insert({
          producto_id: producto.id,
          license_key: licenseKey,
          cliente,
          tipo,
          duracion_dias: duracionDias,
          fecha_inicio: fechaInicio,
          expires_at: expiresAt,
          notas,
          activada_en: fechaInicio ? new Date().toISOString() : null,
          created_by: callerId,
        })
        .select()
        .single();

      if (!error) {
        licencia = data as unknown as Record<string, unknown>;
        break;
      }

      ultimoError = { message: error.message, code: error.code };
      if (error.code !== "23505") break; // solo reintentar por clave duplicada
    }

    if (!licencia) {
      console.error("Error inserting aut_licenses:", ultimoError?.message);
      return jsonError(
        "No se pudo emitir la licencia. Intenta de nuevo.",
        500,
        rateLimitHeaders
      );
    }

    return new Response(
      JSON.stringify({ success: true, licencia }),
      { headers: { ...corsHeaders, ...rateLimitHeaders }, status: 200 }
    );
  } catch (error) {
    console.error("Error in create-license function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
