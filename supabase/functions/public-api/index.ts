import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Extract API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ error: "Missing x-api-key header" }, 401);

    // Validate API key
    const keyHash = await hashKey(apiKey);
    const { data: keyData, error: keyError } = await supabase.rpc("validate_api_key", { _key_hash: keyHash });

    if (keyError || !keyData || keyData.length === 0) {
      return json({ error: "Invalid or expired API key" }, 401);
    }

    const { company_id, scopes, key_id } = keyData[0];

    // Update last_used_at (fire and forget)
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key_id).then();

    // Parse URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /public-api/{resource}[/{id}]
    const resource = pathParts[1] || "";
    const resourceId = pathParts[2] || null;

    // Check scope
    const hasScope = (scope: string) => scopes.includes(scope) || scopes.includes("admin");

    // Pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    switch (resource) {
      case "sessions": {
        if (!hasScope("read")) return json({ error: "Insufficient scope" }, 403);
        let query = supabase
          .from("sessions")
          .select("id, title, session_date, status, session_type, location, meeting_link, is_virtual, numero_session, organ_id, created_at", { count: "exact" })
          .eq("company_id", company_id)
          .order("session_date", { ascending: false })
          .range(from, to);

        if (resourceId) query = supabase.from("sessions").select("id, title, session_date, status, session_type, location, meeting_link, is_virtual, numero_session, organ_id, created_at").eq("company_id", company_id).eq("id", resourceId).single();

        const { data, error, count } = await query;
        if (error) return json({ error: error.message }, 400);
        return json(resourceId ? { data } : { data, pagination: { page, limit, total: count } });
      }

      case "minutes": {
        if (!hasScope("read")) return json({ error: "Insufficient scope" }, 403);
        let query = supabase
          .from("minutes")
          .select("id, session_id, pv_status, content, validated_at, signed_at, created_at, updated_at", { count: "exact" })
          .eq("company_id", company_id)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (resourceId) query = supabase.from("minutes").select("id, session_id, pv_status, content, validated_at, signed_at, created_at, updated_at").eq("company_id", company_id).eq("id", resourceId).single();

        const { data, error, count } = await query;
        if (error) return json({ error: error.message }, 400);
        return json(resourceId ? { data } : { data, pagination: { page, limit, total: count } });
      }

      case "members": {
        if (!hasScope("read")) return json({ error: "Insufficient scope" }, 403);
        let query = supabase
          .from("members")
          .select("id, full_name, email, phone, quality, organ_id, is_active, mandate_start, mandate_end, titre_poste, organisation, created_at", { count: "exact" })
          .eq("company_id", company_id)
          .order("full_name")
          .range(from, to);

        if (resourceId) query = supabase.from("members").select("id, full_name, email, phone, quality, organ_id, is_active, mandate_start, mandate_end, titre_poste, organisation, bio, nationalite, created_at").eq("company_id", company_id).eq("id", resourceId).single();

        const { data, error, count } = await query;
        if (error) return json({ error: error.message }, 400);
        return json(resourceId ? { data } : { data, pagination: { page, limit, total: count } });
      }

      case "documents": {
        if (!hasScope("read")) return json({ error: "Insufficient scope" }, 403);
        let query = supabase
          .from("documents")
          .select("id, name, category, mime_type, file_size, version, session_id, created_at", { count: "exact" })
          .eq("company_id", company_id)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (resourceId) query = supabase.from("documents").select("id, name, category, mime_type, file_size, version, session_id, agenda_item_id, created_at").eq("company_id", company_id).eq("id", resourceId).single();

        const { data, error, count } = await query;
        if (error) return json({ error: error.message }, 400);
        return json(resourceId ? { data } : { data, pagination: { page, limit, total: count } });
      }

      case "decisions": {
        if (!hasScope("read")) return json({ error: "Insufficient scope" }, 403);
        let query = supabase
          .from("decisions")
          .select("id, texte, numero_decision, statut, type_vote, vote_pour, vote_contre, vote_abstention, session_id, date_effet, created_at", { count: "exact" })
          .eq("company_id", company_id)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (resourceId) query = supabase.from("decisions").select("id, texte, numero_decision, statut, type_vote, vote_pour, vote_contre, vote_abstention, session_id, agenda_item_id, date_effet, created_at").eq("company_id", company_id).eq("id", resourceId).single();

        const { data, error, count } = await query;
        if (error) return json({ error: error.message }, 400);
        return json(resourceId ? { data } : { data, pagination: { page, limit, total: count } });
      }

      case "organs": {
        if (!hasScope("read")) return json({ error: "Insufficient scope" }, 403);
        const { data, error } = await supabase
          .from("organs")
          .select("id, name, type, description, created_at")
          .eq("company_id", company_id)
          .order("name");

        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }

      default:
        return json({
          message: "GrigraBoard Public API v1",
          endpoints: [
            "GET /sessions", "GET /sessions/:id",
            "GET /minutes", "GET /minutes/:id",
            "GET /members", "GET /members/:id",
            "GET /documents", "GET /documents/:id",
            "GET /decisions", "GET /decisions/:id",
            "GET /organs",
          ],
          pagination: "Use ?page=1&limit=20 (max 100)",
        });
    }
  } catch (e) {
    console.error("API error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
