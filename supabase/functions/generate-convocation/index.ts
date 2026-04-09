import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { organ_name, session_title, session_date, location, meeting_link, agenda_items } = await req.json();

    if (!agenda_items || agenda_items.length === 0) {
      return new Response(JSON.stringify({ error: "Aucun point à l'ordre du jour" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await supabase.from("profiles").select("company_id, companies(nom)").eq("id", user.id).single();
    const companyName = (profile as any)?.companies?.nom || "l'Organisation";

    let formattedDate = session_date;
    try {
      formattedDate = new Date(session_date).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { /* keep raw */ }

    const agendaList = agenda_items.map((item: any) => `${item.order}. ${item.title}${item.description ? ` — ${item.description}` : ""}`).join("\n");
    const locationInfo = location ? `Lieu : ${location}` : "";
    const linkInfo = meeting_link ? `Lien visioconférence : ${meeting_link}` : "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Configuration IA manquante" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `Tu es un secrétaire juridique professionnel spécialisé dans la gouvernance d'entreprise en Afrique francophone. Tu rédiges des lettres de convocation formelles pour les réunions des organes de gouvernance.

IMPORTANT : Tu dois répondre UNIQUEMENT en HTML valide (pas de markdown). Utilise les balises HTML suivantes :
- <h1> pour le titre principal (nom de la société)
- <h2> pour l'objet
- <p> pour les paragraphes
- <ol> et <li> pour l'ordre du jour numéroté
- <strong> pour les éléments importants
- <br> pour les sauts de ligne dans un même paragraphe
- <hr> pour les séparateurs

Ne mets PAS de balises <html>, <head>, <body>. Commence directement avec le contenu.

La lettre doit inclure :
1. En-tête avec le nom de la société
2. L'objet de la convocation
3. Les salutations formelles
4. Le corps avec la date, le lieu, et l'ordre du jour numéroté
5. Les informations pratiques
6. La formule de politesse
7. Le signataire "[Nom du Président]"`;

    const userPrompt = `Rédige une lettre de convocation officielle en HTML avec ces informations :

Société : ${companyName}
Organe : ${organ_name}
Titre de la session : ${session_title}
Date : ${formattedDate}
${locationInfo}
${linkInfo}

Ordre du jour :
${agendaList}`;

    console.log("Calling AI gateway...");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, veuillez réessayer." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json();
    console.log("AI response received");
    let letter = aiData.choices?.[0]?.message?.content || "";
    
    // Strip markdown code fences if present
    letter = letter.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    if (!letter) {
      return new Response(JSON.stringify({ error: "Aucun contenu généré par l'IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ letter }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-convocation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
