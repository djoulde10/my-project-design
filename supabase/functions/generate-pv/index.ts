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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { transcription, meetingTitle, meetingDate, templateContent } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const templateInstruction = templateContent 
      ? `\n\nVoici un exemple de procès-verbal dont tu dois t'inspirer pour le format, le style et la structure :\n\n${templateContent}\n\nRespecte ce format autant que possible.`
      : "";

    const systemPrompt = `Tu es un rédacteur professionnel de procès-verbaux de réunions d'organes de gouvernance (Conseil d'Administration, Comités).

Tu dois analyser la transcription d'une réunion et générer un procès-verbal structuré et professionnel en français.

Le procès-verbal doit inclure :
1. **En-tête** : Titre de la réunion, date, lieu
2. **Participants** : Liste des présents identifiés dans la transcription
3. **Ordre du jour** : Points discutés
4. **Discussions** : Résumé structuré de chaque point abordé
5. **Décisions prises** : Toutes les décisions avec les résultats de vote si mentionnés
6. **Actions à réaliser** : Tâches assignées avec responsable et délai si mentionnés
7. **Clôture** : Heure de clôture et prochaine réunion si mentionnée

Rédige de manière formelle, claire et concise. Utilise un langage professionnel adapté à la gouvernance d'entreprise.${templateInstruction}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Voici la transcription de la réunion "${meetingTitle}" du ${meetingDate} :\n\n${transcription}\n\nGénère le procès-verbal complet.` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const generatedPV = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ pv: generatedPV }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-pv error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
