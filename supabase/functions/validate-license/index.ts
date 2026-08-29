// validate-license - API pública de validación multi-producto.
//
// verify_jwt=false (las apps externas no tienen JWT de Supabase). Protección:
//   1. Rate limit estricto distribuido por IP (anti fuerza bruta).
//   2. Producto validado primero (existe/activo) para resolver SU secreto (D4).
//   3. Verificación HMAC timing-safe ANTES de consultar la licencia en BD.
//   4. Fail-closed: ante cualquier error interno la clave NO se considera válida.
//   5. Respuesta mínima sin fugas: nunca devuelve cliente, notas ni claves ajenas.
//
// POST { "producto": "AUTOSTOCK", "license_key": "XXXX-XXXX-XXXX-XXXX-XXXX" }
// -> { valida, estado, fecha_inicio, expires_at, dias_restantes }
//    estados: formato_invalido | producto_invalido | producto_inactivo |
//             firma_invalida | desconocida | revocada | pendiente |
//             programada | expirada | activa

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getIdentifier, RATE_LIMIT_CONFIGS } from "../_shared/rate-limit.ts";
import {
  checkDistributedRateLimit,
  getRateLimitHeaders,
} from "../_shared/distributed-rate-limit.ts";
import {
  getLicenseSecret,
  isValidKeyFormat,
  normalizeKey,
  toGroupedFormat,
  verifyLicenseKey,
  PRODUCTO_RE,
} from "../_shared/license-keys.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DIA_MS = 86400000;

function responder(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: corsHeaders,
    status,
  });
}

function rechazo(estado: string, base?: {
  fecha_inicio: string | null;
  expires_at: string | null;
  dias_restantes: number | null;
}): Response {
  return responder({
    valida: false,
    estado,
    fecha_inicio: base?.fecha_inicio ?? null,
    expires_at: base?.expires_at ?? null,
    dias_restantes: base?.dias_restantes ?? null,
  });
}

function hoyIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return responder({ error: "Método no permitido. Usa POST." }, 405);
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limit estricto por IP (30/min) — anti enumeración de claves
    const identifier = getIdentifier(req);
    const rateLimit = await checkDistributedRateLimit(
      supabaseAdmin,
      identifier,
      RATE_LIMIT_CONFIGS.read.maxRequests,
      Math.round(RATE_LIMIT_CONFIGS.read.windowMs / 1000)
    );
    const headersRL = getRateLimitHeaders(rateLimit.remaining, rateLimit.retryAfter);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", retryAfter: rateLimit.retryAfter }),
        { headers: { ...corsHeaders, ...headersRL }, status: 429 }
      );
    }

    const body = await req.json().catch(() => null);

    // 1) Formato barato primero
    const claveCruda = typeof body?.license_key === "string" ? body.license_key : "";
    if (!claveCruda || !isValidKeyFormat(claveCruda)) {
      return rechazo("formato_invalido");
    }

    // 2) Producto obligatorio y con formato válido
    const productoCodigo =
      typeof body?.producto === "string"
        ? body.producto.trim().toUpperCase()
        : "";
    if (!PRODUCTO_RE.test(productoCodigo)) {
      return rechazo("producto_invalido");
    }

    // 3) El producto debe existir y estar activo (consulta barata indexada)
    const { data: producto, error: productoError } = await supabaseAdmin
      .from("productos")
      .select("id, activo")
      .eq("codigo", productoCodigo)
      .maybeSingle();

    if (productoError) {
      console.error("Error consultando productos:", productoError.message);
      return responder({ error: "Servicio de validación no disponible" }, 503);
    }
    if (!producto) {
      return rechazo("producto_invalido");
    }
    if (!producto.activo) {
      return rechazo("producto_inactivo");
    }

    // 4) Secreto del producto (503 genérico si falta; sin detalles al exterior)
    let secret: string;
    try {
      secret = getLicenseSecret(productoCodigo);
    } catch (_err) {
      console.error(`LICENSE_SECRET_${productoCodigo} no configurada`);
      return responder(
        { error: "Servicio de validación no disponible" },
        503
      );
    }

    // 5) Firma HMAC antes de consultar la licencia (rechazo barato y sin pistas)
    const firmaValida = await verifyLicenseKey(claveCruda, secret);
    if (!firmaValida) {
      return rechazo("firma_invalida");
    }

    // 6) La clave debe existir Y pertenecer a este producto
    const claveFormateada = toGroupedFormat(normalizeKey(claveCruda));
    const { data, error } = await supabaseAdmin
      .from("aut_licenses")
      .select("producto_id, fecha_inicio, expires_at, is_active")
      .eq("license_key", claveFormateada)
      .maybeSingle();

    if (error) {
      console.error("Error consultando aut_licenses:", error.message);
      // Fail-closed: ante error de BD la licencia NO se considera válida
      return responder({ error: "Servicio de validación no disponible" }, 503);
    }

    if (!data || data.producto_id !== producto.id) {
      // Clave de otro producto se reporta como desconocida (sin filtrar nada)
      return rechazo("desconocida");
    }

    const base = {
      fecha_inicio: data.fecha_inicio,
      expires_at: data.expires_at,
      dias_restantes: null as number | null,
    };

    if (!data.is_active) {
      return rechazo("revocada", base);
    }
    if (!data.fecha_inicio) {
      return rechazo("pendiente", base);
    }

    const hoy = hoyIsoUtc();
    if (data.fecha_inicio > hoy) {
      return rechazo("programada", base);
    }

    // Expiración inclusiva: vale hasta el final del día UTC de expires_at
    const finVigencia = data.expires_at
      ? Date.parse(`${data.expires_at}T23:59:59Z`)
      : Number.NaN;
    if (Number.isNaN(finVigencia)) {
      return rechazo("expirada", base);
    }

    const diasRestantes = Math.ceil((finVigencia - Date.now()) / DIA_MS);
    if (diasRestantes <= 0) {
      return responder({
        valida: false,
        estado: "expirada",
        fecha_inicio: data.fecha_inicio,
        expires_at: data.expires_at,
        dias_restantes: 0,
      });
    }

    return responder({
      valida: true,
      estado: "activa",
      fecha_inicio: data.fecha_inicio,
      expires_at: data.expires_at,
      dias_restantes: diasRestantes,
    });
  } catch (err) {
    console.error("Error in validate-license function:", err);
    return responder({ error: "Error interno" }, 500);
  }
});
