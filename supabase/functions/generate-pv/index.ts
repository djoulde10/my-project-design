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

    let systemPrompt: string;

    const strictRules = `
RÈGLES STRICTES DE RÉDACTION :
- Rédige UNIQUEMENT ce qui est strictement nécessaire pour un procès-verbal officiel.
- AUCUNE paraphrase, AUCUNE reformulation vague, AUCUN commentaire interprétatif.
- Chaque phrase doit être factuelle, précise et vérifiable.
- Cite les noms exacts des intervenants quand ils sont identifiés.
- Les décisions doivent être formulées mot pour mot telles qu'adoptées.
- Les votes doivent mentionner les chiffres exacts (pour, contre, abstention).
- Les actions doivent préciser : responsable, objet exact, délai.
- Ne fais AUCUNE supposition. Si une information n'est pas dans la transcription, ne l'invente pas.
- Pas de formules creuses comme "après discussion approfondie", "il a été longuement débattu", etc.
- Va droit au but : qui a dit quoi, quelle décision, quel vote, quelle action.
- Le PV doit être un document juridique exploitable, pas un résumé narratif.`;

    if (templateContent) {
      systemPrompt = `Tu es un rédacteur professionnel de procès-verbaux de réunions d'organes de gouvernance (Conseil d'Administration, Comités).

UN MODÈLE DE PV T'EST FOURNI CI-DESSOUS. TU DOIS LE REPRODUIRE FIDÈLEMENT.

INSTRUCTIONS STRICTES — REPRODUCTION DU MODÈLE :
1. **En-tête** : Reproduis EXACTEMENT la même structure d'en-tête que le modèle (logo, titre, numéro de session, date, lieu, heure d'ouverture, etc.). Conserve les mêmes formulations et la même disposition.
2. **Mise en forme** : Copie fidèlement le style du modèle : titres, sous-titres, numérotation, puces, retraits, séparateurs, mises en gras, italiques, soulignements.
3. **Structure des sections** : Utilise EXACTEMENT les mêmes sections et titres de sections que dans le modèle. Ne change pas l'ordre, n'ajoute pas de sections non présentes dans le modèle, ne supprime pas de sections du modèle.
4. **Formulations** : Réutilise les mêmes formulations types, expressions juridiques, tournures de phrases et style rédactionnel que le modèle.
5. **Paragraphes et transitions** : Reproduis le même style de paragraphes (longueur, niveau de détail, formulations de transition entre les points).
6. **Clôture** : Reproduis exactement le format de clôture du modèle (formulations de clôture, signatures, mentions légales, etc.).

${strictRules}

VOICI LE MODÈLE DE RÉFÉRENCE À REPRODUIRE :
---
${templateContent}
---

À partir de la transcription fournie, génère un procès-verbal qui suit CE MODÈLE à la lettre en termes de structure, mise en forme, en-tête, style rédactionnel et formulations. Seul le contenu factuel (discussions, décisions, participants) doit provenir de la transcription.`;
    } else {
      systemPrompt = `Tu es un rédacteur professionnel de procès-verbaux de réunions d'organes de gouvernance (Conseil d'Administration, Comités).

Tu dois analyser la transcription d'une réunion et générer un procès-verbal structuré et professionnel en français.

Le procès-verbal doit inclure UNIQUEMENT :
1. **En-tête** : Titre de la réunion, date, lieu, heure d'ouverture
2. **Participants** : Liste des présents et absents excusés
3. **Constatation du quorum**
4. **Ordre du jour** : Points listés
5. **Pour chaque point** : Intervenant, contenu factuel précis, décision prise avec résultat du vote
6. **Résolutions** : Texte exact de chaque résolution avec résultat du vote chiffré
7. **Actions décidées** : Responsable, objet, délai
8. **Clôture** : Heure de clôture

${strictRules}`;
    }

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
