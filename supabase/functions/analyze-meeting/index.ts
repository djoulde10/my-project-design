import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { minuteId, pvContent, sessionId } = await req.json();
    if (!minuteId || !pvContent) {
      return new Response(JSON.stringify({ error: "minuteId and pvContent are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch previous meetings context for agenda suggestions
    let previousContext = "";
    if (sessionId) {
      const { data: prevMinutes } = await supabase
        .from("minutes")
        .select("content, session_id, sessions(title, session_date)")
        .neq("id", minuteId)
        .order("created_at", { ascending: false })
        .limit(3);
      
      if (prevMinutes && prevMinutes.length > 0) {
        previousContext = "\n\nContexte des réunions précédentes (pour suggestions d'ordre du jour) :\n" +
          prevMinutes.map((m: any) => `- ${m.sessions?.title || "Réunion"} (${m.sessions?.session_date || ""}): ${(m.content || "").substring(0, 500)}`).join("\n");
      }

      // Fetch pending actions
      const { data: pendingActions } = await supabase
        .from("actions")
        .select("title, status, due_date")
        .in("status", ["en_cours", "en_retard"])
        .limit(20);

      if (pendingActions && pendingActions.length > 0) {
        previousContext += "\n\nActions en cours ou en retard :\n" +
          pendingActions.map((a: any) => `- ${a.title} (statut: ${a.status}, échéance: ${a.due_date || "non définie"})`).join("\n");
      }
    }

    const systemPrompt = `Tu es un assistant IA spécialisé dans l'analyse de procès-verbaux de réunions de gouvernance (Conseil d'Administration, Comités).

Tu dois analyser le contenu d'un procès-verbal et extraire des informations structurées. Tu DOIS appeler la fonction "extract_meeting_analysis" avec les résultats.

Règles :
- Les décisions doivent être clairement formulées, avec le type de vote si mentionné
- Les actions doivent inclure un responsable et une échéance si identifiés dans le texte
- Le résumé exécutif doit être concis (3-5 paragraphes max)
- Les suggestions d'ordre du jour doivent se baser sur les actions non terminées, les décisions nécessitant un suivi et les sujets récurrents
- Toutes les extractions sont des SUGGESTIONS qui devront être validées par un humain${previousContext}`;

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
          { role: "user", content: `Analyse ce procès-verbal et extrais les informations structurées :\n\n${pvContent}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_meeting_analysis",
              description: "Extraire l'analyse structurée d'un procès-verbal de réunion",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Résumé exécutif de la réunion (3-5 paragraphes)"
                  },
                  decisions: {
                    type: "array",
                    description: "Liste des décisions identifiées",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string", description: "Texte de la décision" },
                        vote_type: { type: "string", description: "Type de vote: unanimite, majorite, autre", enum: ["unanimite", "majorite", "autre"] },
                        vote_pour: { type: "number", description: "Nombre de votes pour (si mentionné)" },
                        vote_contre: { type: "number", description: "Nombre de votes contre (si mentionné)" },
                        vote_abstention: { type: "number", description: "Nombre d'abstentions (si mentionné)" }
                      },
                      required: ["text"],
                      additionalProperties: false
                    }
                  },
                  actions: {
                    type: "array",
                    description: "Liste des actions/tâches identifiées",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Titre court de l'action" },
                        description: { type: "string", description: "Description détaillée" },
                        responsible: { type: "string", description: "Nom du responsable si mentionné" },
                        due_date: { type: "string", description: "Date limite si mentionnée (format YYYY-MM-DD)" }
                      },
                      required: ["title"],
                      additionalProperties: false
                    }
                  },
                  next_agenda: {
                    type: "array",
                    description: "Suggestions de points pour l'ordre du jour de la prochaine réunion",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Titre du point suggéré" },
                        reason: { type: "string", description: "Raison de la suggestion" }
                      },
                      required: ["title", "reason"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["summary", "decisions", "actions", "next_agenda"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_meeting_analysis" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("L'IA n'a pas retourné d'analyse structurée");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-meeting error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
