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
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const { messages, context_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch contextual data for the AI
    let contextInfo = "";

    if (context_type === "document_analysis" || context_type === "general") {
      // Fetch recent sessions
      const { data: sessions } = await supabase
        .from("sessions")
        .select("title, session_date, status, organs(name)")
        .order("session_date", { ascending: false })
        .limit(5);
      if (sessions?.length) {
        contextInfo += "\n\nSessions récentes:\n" + sessions.map((s: any) =>
          `- ${s.title} (${s.organs?.name || ''}, ${new Date(s.session_date).toLocaleDateString('fr-FR')}, statut: ${s.status})`
        ).join("\n");
      }

      // Fetch recent actions
      const { data: actions } = await supabase
        .from("actions")
        .select("title, status, due_date, members(full_name)")
        .eq("status", "en_cours")
        .order("due_date", { ascending: true })
        .limit(10);
      if (actions?.length) {
        contextInfo += "\n\nActions en cours:\n" + actions.map((a: any) =>
          `- ${a.title} (responsable: ${a.members?.full_name || 'N/A'}, échéance: ${a.due_date || 'N/A'}, statut: ${a.status})`
        ).join("\n");
      }

      // Fetch recent decisions
      const { data: decisions } = await supabase
        .from("decisions")
        .select("numero_decision, texte, statut")
        .order("created_at", { ascending: false })
        .limit(5);
      if (decisions?.length) {
        contextInfo += "\n\nRésolutions récentes:\n" + decisions.map((d: any) =>
          `- ${d.numero_decision}: ${d.texte?.substring(0, 100)}... (${d.statut})`
        ).join("\n");
      }

      // Fetch pending approvals
      const { data: approvals } = await supabase
        .from("approval_requests")
        .select("entity_type, action, status, requested_at")
        .eq("status", "pending")
        .limit(5);
      if (approvals?.length) {
        contextInfo += "\n\nDemandes d'approbation en attente:\n" + approvals.map((a: any) =>
          `- ${a.action} sur ${a.entity_type} (depuis ${new Date(a.requested_at).toLocaleDateString('fr-FR')})`
        ).join("\n");
      }
    }

    const systemPrompt = `Tu es l'assistant IA de GovBoard, une plateforme de gouvernance d'entreprise. Tu aides les utilisateurs dans la gestion administrative et documentaire.

RÈGLES ESSENTIELLES:
- Tu ne dois JAMAIS valider ou exécuter une action automatiquement
- Toutes tes propositions sont des SUGGESTIONS qui doivent être validées par une personne autorisée
- Tu présentes toujours tes suggestions clairement avec des marqueurs comme "💡 Suggestion:" ou "📋 Proposition:"
- Tu réponds toujours en français

TES CAPACITÉS:
- Analyser des documents et proposer des résumés
- Suggérer des ordres du jour basés sur les sessions précédentes
- Détecter des incohérences ou informations manquantes
- Aider à la rédaction de comptes rendus
- Suggérer la classification de documents
- Proposer des actions de suivi basées sur les décisions

CONTEXTE ACTUEL DE L'ORGANISATION:${contextInfo}

Quand tu proposes une action, précise toujours qu'elle nécessite la validation d'un responsable autorisé.`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Veuillez réessayer dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
