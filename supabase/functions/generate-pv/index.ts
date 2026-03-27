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

    const { transcription, meetingTitle, meetingDate, templateContent, mode, orgName, orgLogoUrl, orgColor } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const pvMode = mode === "simplifie" ? "simplifie" : "professionnel";

    const formatRules = `
RÈGLES DE FORMAT — SORTIE HTML UNIQUEMENT :
- Tu dois produire du HTML propre et sémantique. JAMAIS de Markdown (pas de **, ##, -, etc.).
- Utilise les balises HTML suivantes :
  • <h1> pour le titre principal du document
  • <h2> pour les titres de sections (numérotés : 1., 2., 3., etc.)
  • <h3> pour les sous-sections si nécessaire
  • <p> pour les paragraphes de texte
  • <ul> et <li> pour les listes à puces
  • <ol> et <li> pour les listes numérotées
  • <strong> pour les éléments à mettre en valeur (noms, décisions clés)
  • <br> pour les sauts de ligne à l'intérieur d'un bloc si nécessaire
  • <table>, <thead>, <tbody>, <tr>, <th>, <td> pour les tableaux
- Chaque section doit être séparée visuellement (espacement naturel entre les balises de titre et les paragraphes).
- Les paragraphes doivent être aérés : une idée par paragraphe, pas de blocs compacts.
- NE PAS inclure de balises <html>, <head>, <body>, <style> ou <doctype>. Génère uniquement le contenu du corps du document.`;

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

    const styleRules = `
RÈGLES DE STYLE RÉDACTIONNEL :
- Le ton doit être formel, administratif et professionnel.
- Utilise un langage soutenu adapté aux documents officiels de gouvernance.
- JAMAIS de formulations techniques comme "Non précisé dans la transcription" ou "[Non précisé]".
- Si une information est absente, utilise des formulations naturelles comme :
  • "Information non communiquée lors de la séance"
  • "Élément non abordé au cours de la réunion"
  • Ou simplement omets la ligne si elle n'apporte rien.
- Ne répète pas les mentions d'informations manquantes. Si plusieurs champs sont absents, regroupe-les élégamment ou omets-les.
- Les actions décidées doivent être présentées sous forme de liste structurée claire :
  <ul><li><strong>Responsable :</strong> Nom — <strong>Action :</strong> Description — <strong>Délai :</strong> Date</li></ul>
  ou sous forme de tableau HTML si plusieurs actions existent.
- Le document doit donner l'impression d'avoir été rédigé par un secrétaire de séance professionnel.`;

    const modeInstructions = pvMode === "simplifie" 
      ? `\nMODE SIMPLIFIÉ :
- Produis un procès-verbal concis et synthétique.
- Concentre-toi sur les décisions prises, les votes et les actions.
- Réduis les discussions à une phrase de contexte maximum par point.
- Le document doit tenir sur 1 à 2 pages maximum.`
      : `\nMODE PROFESSIONNEL :
- Produis un procès-verbal complet et détaillé.
- Inclus les interventions significatives des participants.
- Développe le contexte des discussions pour chaque point de l'ordre du jour.
- Le document doit être exhaustif et exploitable juridiquement.`;

    let systemPrompt: string;

    if (templateContent) {
      systemPrompt = `Tu es un rédacteur professionnel de procès-verbaux de réunions d'organes de gouvernance (Conseil d'Administration, Comités).

UN MODÈLE DE PV T'EST FOURNI CI-DESSOUS. TU DOIS LE REPRODUIRE FIDÈLEMENT.

INSTRUCTIONS STRICTES — REPRODUCTION DU MODÈLE :
1. **En-tête** : Reproduis EXACTEMENT la même structure d'en-tête que le modèle. Conserve les mêmes formulations et la même disposition.
2. **Mise en forme** : Copie fidèlement le style du modèle en utilisant les balises HTML appropriées.
3. **Structure des sections** : Utilise EXACTEMENT les mêmes sections et titres de sections que dans le modèle. Ne change pas l'ordre, n'ajoute pas de sections non présentes dans le modèle, ne supprime pas de sections du modèle.
4. **Formulations** : Réutilise les mêmes formulations types, expressions juridiques, tournures de phrases et style rédactionnel que le modèle.
5. **Paragraphes et transitions** : Reproduis le même style de paragraphes.
6. **Clôture** : Reproduis exactement le format de clôture du modèle.

${formatRules}
${strictRules}
${styleRules}
${modeInstructions}

VOICI LE MODÈLE DE RÉFÉRENCE À REPRODUIRE :
---
${templateContent}
---

À partir de la transcription fournie, génère un procès-verbal HTML qui suit CE MODÈLE à la lettre en termes de structure, mise en forme, en-tête, style rédactionnel et formulations. Seul le contenu factuel (discussions, décisions, participants) doit provenir de la transcription.`;
    } else {
      systemPrompt = `Tu es un rédacteur professionnel de procès-verbaux de réunions d'organes de gouvernance (Conseil d'Administration, Comités).

Tu dois analyser la transcription d'une réunion et générer un procès-verbal structuré et professionnel en HTML.

Le procès-verbal doit suivre cette structure :

<h1>PROCÈS-VERBAL DE [TYPE DE RÉUNION]</h1>

<h2>1. Informations générales</h2>
<p>Titre, date, lieu, heure d'ouverture — présentés dans un paragraphe ou une liste claire.</p>

<h2>2. Participants</h2>
<p>Liste des présents et absents excusés, présentée sous forme de liste HTML.</p>

<h2>3. Constatation du quorum</h2>
<p>Mention du quorum atteint ou non.</p>

<h2>4. Ordre du jour</h2>
<ol>Points listés</ol>

<h2>5. Déroulement de la séance</h2>
<p>Pour chaque point : intervenant, contenu factuel précis, décision prise avec résultat du vote.</p>

<h2>6. Résolutions adoptées</h2>
<p>Texte exact de chaque résolution avec résultat du vote chiffré.</p>

<h2>7. Actions décidées</h2>
<p>Liste ou tableau avec : responsable, objet, délai.</p>

<h2>8. Clôture de la séance</h2>
<p>Heure de clôture et formule de clôture.</p>

${formatRules}
${strictRules}
${styleRules}
${modeInstructions}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Voici la transcription de la réunion "${meetingTitle}" du ${meetingDate} :\n\n${transcription}\n\nGénère le procès-verbal complet en HTML propre et professionnel.` },
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
    let generatedPV = data.choices?.[0]?.message?.content || "";

    // Clean up any markdown artifacts that might slip through
    generatedPV = generatedPV
      .replace(/```html?\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

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
