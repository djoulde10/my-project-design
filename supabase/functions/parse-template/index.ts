import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { templateId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use service role client for storage/DB operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate template belongs to user's company
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    const { data: template } = await supabase
      .from("meeting_templates")
      .select("company_id, file_path")
      .eq("id", templateId)
      .single();

    if (!template || (profile?.company_id && template.company_id !== profile.company_id)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download the file from storage using DB path, not user input
    const safeFilePath = template.file_path;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pv-templates")
      .download(safeFilePath);

    if (downloadError || !fileData) throw new Error("Failed to download template file");

    const fileText = await fileData.text();

    // Use AI to extract structure from template
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Tu es un analyseur de documents. Extrais la structure, le style et le format de ce procès-verbal modèle. Décris précisément : les sections, les titres, le style de rédaction, la mise en page, les formulations utilisées. L'objectif est de pouvoir reproduire ce format pour de futurs PV.",
          },
          {
            role: "user",
            content: `Voici le contenu d'un procès-verbal modèle :\n\n${fileText}\n\nAnalyse et décris sa structure et son style.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI analysis failed [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const extractedContent = data.choices?.[0]?.message?.content || "";

    // Update the template with extracted content
    await supabase
      .from("meeting_templates")
      .update({ extracted_content: extractedContent })
      .eq("id", templateId);

    return new Response(JSON.stringify({ content: extractedContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-template error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
