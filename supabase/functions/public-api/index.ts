import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function success(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status: "success", data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function successList(data: unknown, pagination: unknown) {
  return new Response(JSON.stringify({ status: "success", data, pagination }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return new Response(JSON.stringify({ status: "error", message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Simple in-memory rate limiter (per isolate)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(keyId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(keyId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function getRateLimitHeaders(keyId: string): Record<string, string> {
  const entry = rateLimits.get(keyId);
  if (!entry) return {};
  const remaining = Math.max(0, RATE_LIMIT - entry.count);
  const reset = Math.ceil((entry.resetAt - Date.now()) / 1000);
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.max(0, reset)),
  };
}

function getPagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "20")), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // --- Auth: support both Bearer and x-api-key ---
    let apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader.toLowerCase().startsWith("bearer ")) {
        apiKey = authHeader.slice(7).trim();
      }
    }
    if (!apiKey) return error("Clé API manquante. Utilisez l'en-tête Authorization: Bearer <clé> ou x-api-key.", 401);

    const keyHash = await hashKey(apiKey);
    const { data: keyData, error: keyError } = await supabase.rpc("validate_api_key", { _key_hash: keyHash });
    if (keyError || !keyData || keyData.length === 0) return error("Clé API invalide ou expirée.", 401);

    const { company_id, scopes, key_id } = keyData[0];

    // --- Rate limiting ---
    if (!checkRateLimit(key_id)) {
      const resp = error("Limite de requêtes dépassée. Réessayez dans quelques instants.", 429);
      const rlHeaders = getRateLimitHeaders(key_id);
      for (const [k, v] of Object.entries(rlHeaders)) resp.headers.set(k, v);
      return resp;
    }

    // Update last_used_at (fire and forget)
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key_id).then();

    // --- Audit logging (fire and forget) ---
    const logEntry = {
      action: `api_${req.method.toLowerCase()}`,
      entity_type: "api_request",
      company_id,
      details: {
        method: req.method,
        path: new URL(req.url).pathname,
        key_id,
        timestamp: new Date().toISOString(),
      },
    };
    supabase.from("audit_log").insert(logEntry).then();

    // --- Parse route ---
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected: /public-api/v1/{resource}[/{id}]  OR  /public-api/{resource}[/{id}] (legacy)
    let resource: string;
    let resourceId: string | null;

    if (pathParts[1] === "v1") {
      resource = pathParts[2] || "";
      resourceId = pathParts[3] || null;
    } else {
      // legacy support (no version prefix)
      resource = pathParts[1] || "";
      resourceId = pathParts[2] || null;
    }

    const hasScope = (scope: string) => scopes.includes(scope) || scopes.includes("admin");
    const method = req.method;

    // Add rate limit headers to all success responses
    const addRL = (resp: Response) => {
      const rlHeaders = getRateLimitHeaders(key_id);
      for (const [k, v] of Object.entries(rlHeaders)) resp.headers.set(k, v);
      return resp;
    };

    // ========== ROUTING ==========

    switch (resource) {
      // ---------- SESSIONS / MEETINGS ----------
      case "meetings":
      case "sessions": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("sessions")
              .select("id, title, session_date, status, session_type, location, meeting_link, is_virtual, numero_session, organ_id, created_at, updated_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "Réunion introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { page, limit, from, to } = getPagination(url);
          // Filters
          let query = supabase
            .from("sessions")
            .select("id, title, session_date, status, session_type, location, meeting_link, is_virtual, numero_session, organ_id, created_at", { count: "exact" })
            .eq("company_id", company_id);
          if (url.searchParams.get("status")) query = query.eq("status", url.searchParams.get("status")!);
          if (url.searchParams.get("organ_id")) query = query.eq("organ_id", url.searchParams.get("organ_id")!);
          if (url.searchParams.get("from_date")) query = query.gte("session_date", url.searchParams.get("from_date")!);
          if (url.searchParams.get("to_date")) query = query.lte("session_date", url.searchParams.get("to_date")!);
          query = query.order("session_date", { ascending: false }).range(from, to);
          const { data, error: e, count } = await query;
          if (e) return addRL(error(e.message));
          return addRL(successList(data, { page, limit, total: count }));
        }
        if (method === "POST") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          const body = await req.json();
          if (!body.title || !body.session_date || !body.organ_id) return addRL(error("Champs requis: title, session_date, organ_id."));
          const { data, error: e } = await supabase
            .from("sessions")
            .insert({ ...body, company_id })
            .select()
            .single();
          if (e) return addRL(error(e.message));
          return addRL(success(data, 201));
        }
        if (method === "PUT") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          if (!resourceId) return addRL(error("ID requis pour la mise à jour."));
          const body = await req.json();
          delete body.id; delete body.company_id;
          const { data, error: e } = await supabase
            .from("sessions")
            .update(body)
            .eq("id", resourceId)
            .eq("company_id", company_id)
            .select()
            .single();
          if (e) return addRL(error(e.code === "PGRST116" ? "Réunion introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
          return addRL(success(data));
        }
        if (method === "DELETE") {
          if (!hasScope("admin")) return addRL(error("Scope 'admin' requis pour la suppression.", 403));
          if (!resourceId) return addRL(error("ID requis pour la suppression."));
          const { error: e } = await supabase
            .from("sessions")
            .delete()
            .eq("id", resourceId)
            .eq("company_id", company_id);
          if (e) return addRL(error(e.message));
          return addRL(success({ deleted: true }));
        }
        return addRL(error("Méthode non supportée.", 405));
      }

      // ---------- PVS / MINUTES ----------
      case "pvs":
      case "minutes": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("minutes")
              .select("id, session_id, pv_status, content, validated_at, signed_at, created_at, updated_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "PV introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { page, limit, from, to } = getPagination(url);
          let query = supabase
            .from("minutes")
            .select("id, session_id, pv_status, content, validated_at, signed_at, created_at, updated_at", { count: "exact" })
            .eq("company_id", company_id);
          if (url.searchParams.get("pv_status")) query = query.eq("pv_status", url.searchParams.get("pv_status")!);
          if (url.searchParams.get("session_id")) query = query.eq("session_id", url.searchParams.get("session_id")!);
          query = query.order("created_at", { ascending: false }).range(from, to);
          const { data, error: e, count } = await query;
          if (e) return addRL(error(e.message));
          return addRL(successList(data, { page, limit, total: count }));
        }
        if (method === "POST") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          const body = await req.json();
          if (!body.session_id) return addRL(error("Champ requis: session_id."));
          const { data, error: e } = await supabase
            .from("minutes")
            .insert({ ...body, company_id })
            .select()
            .single();
          if (e) return addRL(error(e.message));
          return addRL(success(data, 201));
        }
        if (method === "PUT") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const body = await req.json();
          delete body.id; delete body.company_id;
          const { data, error: e } = await supabase
            .from("minutes")
            .update(body)
            .eq("id", resourceId)
            .eq("company_id", company_id)
            .select()
            .single();
          if (e) return addRL(error(e.code === "PGRST116" ? "PV introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
          return addRL(success(data));
        }
        if (method === "DELETE") {
          if (!hasScope("admin")) return addRL(error("Scope 'admin' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const { error: e } = await supabase
            .from("minutes")
            .delete()
            .eq("id", resourceId)
            .eq("company_id", company_id);
          if (e) return addRL(error(e.message));
          return addRL(success({ deleted: true }));
        }
        return addRL(error("Méthode non supportée.", 405));
      }

      // ---------- USERS (profiles) ----------
      case "users": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url, statut, role_id, created_at, updated_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "Utilisateur introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { page, limit, from, to } = getPagination(url);
          let query = supabase
            .from("profiles")
            .select("id, full_name, avatar_url, statut, role_id, created_at, updated_at", { count: "exact" })
            .eq("company_id", company_id);
          if (url.searchParams.get("statut")) query = query.eq("statut", url.searchParams.get("statut")!);
          query = query.order("full_name").range(from, to);
          const { data, error: e, count } = await query;
          if (e) return addRL(error(e.message));
          return addRL(successList(data, { page, limit, total: count }));
        }
        if (method === "PUT") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const body = await req.json();
          // Only allow safe fields
          const allowed: Record<string, unknown> = {};
          if (body.full_name !== undefined) allowed.full_name = body.full_name;
          if (body.avatar_url !== undefined) allowed.avatar_url = body.avatar_url;
          if (Object.keys(allowed).length === 0) return addRL(error("Aucun champ modifiable fourni."));
          const { data, error: e } = await supabase
            .from("profiles")
            .update(allowed)
            .eq("id", resourceId)
            .eq("company_id", company_id)
            .select()
            .single();
          if (e) return addRL(error(e.code === "PGRST116" ? "Utilisateur introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
          return addRL(success(data));
        }
        // POST and DELETE for users are not supported via API for security
        if (method === "POST") return addRL(error("La création d'utilisateurs n'est pas disponible via l'API. Utilisez l'interface d'administration.", 403));
        if (method === "DELETE") return addRL(error("La suppression d'utilisateurs n'est pas disponible via l'API. Utilisez l'interface d'administration.", 403));
        return addRL(error("Méthode non supportée.", 405));
      }

      // ---------- DOCUMENTS ----------
      case "documents": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("documents")
              .select("id, name, category, mime_type, file_size, version, session_id, agenda_item_id, created_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "Document introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { page, limit, from, to } = getPagination(url);
          let query = supabase
            .from("documents")
            .select("id, name, category, mime_type, file_size, version, session_id, created_at", { count: "exact" })
            .eq("company_id", company_id);
          if (url.searchParams.get("category")) query = query.eq("category", url.searchParams.get("category")!);
          if (url.searchParams.get("session_id")) query = query.eq("session_id", url.searchParams.get("session_id")!);
          query = query.order("created_at", { ascending: false }).range(from, to);
          const { data, error: e, count } = await query;
          if (e) return addRL(error(e.message));
          return addRL(successList(data, { page, limit, total: count }));
        }
        if (method === "DELETE") {
          if (!hasScope("admin")) return addRL(error("Scope 'admin' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const { error: e } = await supabase
            .from("documents")
            .delete()
            .eq("id", resourceId)
            .eq("company_id", company_id);
          if (e) return addRL(error(e.message));
          return addRL(success({ deleted: true }));
        }
        if (method === "POST") return addRL(error("L'upload de documents se fait via l'interface. Utilisez GET pour consulter.", 403));
        return addRL(error("Méthode non supportée.", 405));
      }

      // ---------- DECISIONS ----------
      case "decisions": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("decisions")
              .select("id, texte, numero_decision, statut, type_vote, vote_pour, vote_contre, vote_abstention, session_id, agenda_item_id, date_effet, created_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "Décision introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { page, limit, from, to } = getPagination(url);
          let query = supabase
            .from("decisions")
            .select("id, texte, numero_decision, statut, type_vote, vote_pour, vote_contre, vote_abstention, session_id, date_effet, created_at", { count: "exact" })
            .eq("company_id", company_id);
          if (url.searchParams.get("statut")) query = query.eq("statut", url.searchParams.get("statut")!);
          if (url.searchParams.get("session_id")) query = query.eq("session_id", url.searchParams.get("session_id")!);
          query = query.order("created_at", { ascending: false }).range(from, to);
          const { data, error: e, count } = await query;
          if (e) return addRL(error(e.message));
          return addRL(successList(data, { page, limit, total: count }));
        }
        if (method === "POST") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          const body = await req.json();
          if (!body.texte || !body.session_id) return addRL(error("Champs requis: texte, session_id."));
          const { data, error: e } = await supabase
            .from("decisions")
            .insert({ ...body, company_id })
            .select()
            .single();
          if (e) return addRL(error(e.message));
          return addRL(success(data, 201));
        }
        if (method === "PUT") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const body = await req.json();
          delete body.id; delete body.company_id;
          const { data, error: e } = await supabase
            .from("decisions")
            .update(body)
            .eq("id", resourceId)
            .eq("company_id", company_id)
            .select()
            .single();
          if (e) return addRL(error(e.code === "PGRST116" ? "Décision introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
          return addRL(success(data));
        }
        if (method === "DELETE") {
          if (!hasScope("admin")) return addRL(error("Scope 'admin' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const { error: e } = await supabase
            .from("decisions")
            .delete()
            .eq("id", resourceId)
            .eq("company_id", company_id);
          if (e) return addRL(error(e.message));
          return addRL(success({ deleted: true }));
        }
        return addRL(error("Méthode non supportée.", 405));
      }

      // ---------- MEMBERS ----------
      case "members": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("members")
              .select("id, full_name, email, phone, quality, organ_id, is_active, mandate_start, mandate_end, titre_poste, organisation, bio, nationalite, created_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "Membre introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { page, limit, from, to } = getPagination(url);
          let query = supabase
            .from("members")
            .select("id, full_name, email, phone, quality, organ_id, is_active, mandate_start, mandate_end, titre_poste, organisation, created_at", { count: "exact" })
            .eq("company_id", company_id);
          if (url.searchParams.get("organ_id")) query = query.eq("organ_id", url.searchParams.get("organ_id")!);
          if (url.searchParams.get("is_active")) query = query.eq("is_active", url.searchParams.get("is_active") === "true");
          query = query.order("full_name").range(from, to);
          const { data, error: e, count } = await query;
          if (e) return addRL(error(e.message));
          return addRL(successList(data, { page, limit, total: count }));
        }
        if (method === "POST") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          const body = await req.json();
          if (!body.full_name || !body.organ_id) return addRL(error("Champs requis: full_name, organ_id."));
          const { data, error: e } = await supabase
            .from("members")
            .insert({ ...body, company_id })
            .select()
            .single();
          if (e) return addRL(error(e.message));
          return addRL(success(data, 201));
        }
        if (method === "PUT") {
          if (!hasScope("write")) return addRL(error("Scope 'write' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const body = await req.json();
          delete body.id; delete body.company_id;
          const { data, error: e } = await supabase
            .from("members")
            .update(body)
            .eq("id", resourceId)
            .eq("company_id", company_id)
            .select()
            .single();
          if (e) return addRL(error(e.code === "PGRST116" ? "Membre introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
          return addRL(success(data));
        }
        if (method === "DELETE") {
          if (!hasScope("admin")) return addRL(error("Scope 'admin' requis.", 403));
          if (!resourceId) return addRL(error("ID requis."));
          const { error: e } = await supabase
            .from("members")
            .delete()
            .eq("id", resourceId)
            .eq("company_id", company_id);
          if (e) return addRL(error(e.message));
          return addRL(success({ deleted: true }));
        }
        return addRL(error("Méthode non supportée.", 405));
      }

      // ---------- ORGANS ----------
      case "organs": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("organs")
              .select("id, name, type, description, created_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "Organe introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { data, error: e } = await supabase
            .from("organs")
            .select("id, name, type, description, created_at")
            .eq("company_id", company_id)
            .order("name");
          if (e) return addRL(error(e.message));
          return addRL(success(data));
        }
        return addRL(error("Méthode non supportée. Organes en lecture seule via API.", 405));
      }

      // ---------- ACTIONS ----------
      case "actions": {
        if (method === "GET") {
          if (!hasScope("read")) return addRL(error("Scope 'read' requis.", 403));
          if (resourceId) {
            const { data, error: e } = await supabase
              .from("actions")
              .select("id, title, description, status, due_date, completion_date, responsible_member_id, decision_id, created_at, updated_at")
              .eq("company_id", company_id)
              .eq("id", resourceId)
              .single();
            if (e) return addRL(error(e.code === "PGRST116" ? "Action introuvable." : e.message, e.code === "PGRST116" ? 404 : 400));
            return addRL(success(data));
          }
          const { page, limit, from, to } = getPagination(url);
          let query = supabase
            .from("actions")
            .select("id, title, description, status, due_date, completion_date, responsible_member_id, decision_id, created_at", { count: "exact" })
            .eq("company_id", company_id);
          if (url.searchParams.get("status")) query = query.eq("status", url.searchParams.get("status")!);
          query = query.order("created_at", { ascending: false }).range(from, to);
          const { data, error: e, count } = await query;
          if (e) return addRL(error(e.message));
          return addRL(successList(data, { page, limit, total: count }));
        }
        return addRL(error("Actions en lecture seule via API.", 405));
      }

      // ---------- ROOT / DOCS ----------
      default:
        return addRL(success({
          api: "GrigraBoard Public API",
          version: "v1",
          documentation: "Consultez /api-docs dans l'application pour la documentation complète.",
          endpoints: {
            meetings: { methods: ["GET", "POST", "PUT", "DELETE"], path: "/v1/meetings" },
            pvs: { methods: ["GET", "POST", "PUT", "DELETE"], path: "/v1/pvs" },
            users: { methods: ["GET", "PUT"], path: "/v1/users" },
            documents: { methods: ["GET", "DELETE"], path: "/v1/documents" },
            decisions: { methods: ["GET", "POST", "PUT", "DELETE"], path: "/v1/decisions" },
            members: { methods: ["GET", "POST", "PUT", "DELETE"], path: "/v1/members" },
            organs: { methods: ["GET"], path: "/v1/organs" },
            actions: { methods: ["GET"], path: "/v1/actions" },
          },
          authentication: "Authorization: Bearer <votre_clé_api>",
          rate_limit: `${RATE_LIMIT} requêtes par minute`,
        }));
    }
  } catch (e) {
    console.error("API error:", e);
    return error("Erreur interne du serveur.", 500);
  }
});
