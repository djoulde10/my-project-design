import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const systemPrompt = `Tu es un secrétaire juridique professionnel spécialisé dans la gouvernance d'entreprise en Afrique francophone. Tu rédiges des lettres de convocation/invitation formelles pour les réunions des organes de gouvernance.

IMPORTANT : Tu dois répondre UNIQUEMENT en HTML valide (pas de markdown). Utilise les balises HTML suivantes :
- <h2> pour les titres de sections
- <p> pour les paragraphes
- <ol> et <li> pour l'ordre du jour numéroté
- <strong> pour les éléments importants
- <em> pour l'italique
- <br> pour les sauts de ligne dans un même paragraphe
- <table>, <tr>, <td> pour l'en-tête avec référence et titre

Ne mets PAS de balises <html>, <head>, <body>. Commence directement avec le contenu.

VOICI LE FORMAT EXACT À REPRODUIRE — tu dois suivre cette structure fidèlement :

1. **En-tête** : Un tableau HTML à 2 colonnes :
   - Colonne gauche : "Réf : ………..CA/[NOM SOCIÉTÉ]/[ANNÉE]"
   - Colonne droite : "RÉPUBLIQUE DE GUINÉE" (ou le pays), "Travail-Justice–Solidarité" (devise), "LE PRÉSIDENT"

2. **Date et lieu** : "[Ville], le [date formatée]"

3. **Destinataires** : 
   "À l'attention des :"
   "Membres du [Nom de l'organe] de [Nom société], et"
   "Monsieur le Commissaire aux Comptes"
   En italique : "Par lettre au porteur contre décharge"

4. **Objet** : En gras — "Objet : invitation à la session [type] du [organe] de [société]"

5. **Corps** : 
   - "Chers tous," ou "Madame, Messieurs,"
   - Un paragraphe d'invitation formel indiquant : la société, l'organe, la date, l'heure, le lieu
   - "L'ordre du jour de cette session est arrêté comme suit :"
   - Liste numérotée (<ol>) des points

6. **Formule de clôture** :
   - Un paragraphe demandant aux membres d'honorer l'invitation
   - Formule de politesse : "Veuillez agréer, Madame et Messieurs, l'expression de ma considération distinguée."

7. **Signataire** : Nom en gras — "[Nom du Président]"

STYLE :
- Ton formel, administratif, professionnel
- Langage soutenu adapté aux documents officiels de gouvernance africaine francophone
- Pas de formulations techniques ou de placeholders visibles comme "[Non précisé]"
- Si une information manque, l'omettre élégamment`;

    const userPrompt = `Rédige une lettre d'invitation/convocation officielle en HTML avec ces informations :

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
        model: "google/gemini-3-flash-preview",
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
