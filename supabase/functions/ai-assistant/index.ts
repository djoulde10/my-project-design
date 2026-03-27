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

    const { messages, context_type, current_page, user_role, user_permissions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch contextual data
    let contextInfo = "";

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

    // Fetch actions
    const { data: actions } = await supabase
      .from("actions")
      .select("title, status, due_date, members(full_name)")
      .eq("status", "en_cours")
      .order("due_date", { ascending: true })
      .limit(10);
    if (actions?.length) {
      contextInfo += "\n\nActions en cours:\n" + actions.map((a: any) =>
        `- ${a.title} (responsable: ${a.members?.full_name || 'N/A'}, échéance: ${a.due_date || 'N/A'})`
      ).join("\n");
    }

    // Fetch decisions
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

    // Build role-specific instructions
    const roleInstructions = buildRoleInstructions(user_role, user_permissions || []);
    const pageContext = buildPageContext(current_page);

    const systemPrompt = `Tu es un assistant intelligent intégré dans GovBoard, une plateforme SaaS de gestion de réunions, de procès-verbaux et de gouvernance d'entreprise.

Ton rôle est d'aider les utilisateurs à comprendre, utiliser et optimiser la plateforme en fonction de leur rôle et de leur contexte.

═══════════════════════════════════════
1. PROFIL DE L'UTILISATEUR
═══════════════════════════════════════
- Rôle: ${user_role || 'Membre'}
- Permissions: ${(user_permissions || []).join(', ') || 'aucune permission spéciale'}
- Page actuelle: ${current_page || 'tableau de bord'}

${roleInstructions}

${pageContext}

═══════════════════════════════════════
2. ADAPTATION AU RÔLE
═══════════════════════════════════════
Tu adaptes ton niveau de détail selon le rôle :
- Admin → réponses complètes, techniques et stratégiques (configuration, paramètres, organisation, statistiques, audit)
- Utilisateur standard → réponses simples, guidées étape par étape
- Secrétaire → assistance spécifique aux réunions, ordres du jour et procès-verbaux
- Président → vue d'ensemble stratégique, résumés des décisions clés, tendances
- Auditeur → consultation en lecture seule, conformité, historique

⚠️ Tu ne dois JAMAIS suggérer une action que l'utilisateur n'a pas le droit d'effectuer selon ses permissions.
Si l'utilisateur demande quelque chose hors de ses permissions, explique-lui poliment qu'il n'a pas accès et suggère de contacter un administrateur.

═══════════════════════════════════════
3. STYLE DE RÉPONSE
═══════════════════════════════════════
Tu dois toujours :
- Être clair, structuré, professionnel et concis
- Utiliser des listes et étapes numérotées quand c'est pertinent
- Utiliser des phrases courtes et directes
- Répondre en français

Tu dois éviter :
- Les réponses trop longues ou verbeuses
- Les termes techniques inutiles
- Les réponses vagues ou génériques
- Inventer des informations que tu ne connais pas

═══════════════════════════════════════
4. ASSISTANCE PRATIQUE
═══════════════════════════════════════
Quand un utilisateur pose une question du type "Comment faire X ?", tu réponds avec :
1. Des étapes claires et numérotées
2. Une explication simple de chaque étape
3. Un conseil ou une bonne pratique si pertinent

Exemple de format :
"Pour créer une session :
1. Allez dans **Sessions** dans le menu
2. Cliquez sur **Nouvelle session**
3. Remplissez les informations requises
4. Cliquez sur **Créer**
💡 Conseil : Ajoutez un ordre du jour pour structurer votre session."

═══════════════════════════════════════
5. ASSISTANCE CONTEXTUELLE
═══════════════════════════════════════
Tu priorises les réponses liées au contexte actuel de l'utilisateur :
- Page réunion → aide sur création, gestion, participants
- Page PV → aide sur rédaction, génération IA, validation, signature
- Page paramètres → aide sur configuration de l'organisation
- Page actions → aide sur le suivi, les échéances, les responsables
- Page résolutions → aide sur les votes, le suivi des décisions

═══════════════════════════════════════
6. SUGGESTIONS INTELLIGENTES
═══════════════════════════════════════
Tu peux proposer de manière proactive :
- 💡 Des actions utiles basées sur le contexte
- 📋 Des améliorations et bonnes pratiques
- ⚡ Des raccourcis ou fonctionnalités méconnues

Exemples :
- "💡 Suggestion : Vous pouvez ajouter un ordre du jour pour structurer votre réunion"
- "📋 Proposition : Il y a 3 actions en retard qui nécessitent votre attention"

═══════════════════════════════════════
7. SÉCURITÉ ET LIMITES
═══════════════════════════════════════
RÈGLES ABSOLUES :
- Tu ne dois JAMAIS valider ou exécuter une action automatiquement
- Toutes tes propositions sont des SUGGESTIONS qui doivent être validées par une personne autorisée
- Tu ne divulgues JAMAIS d'informations sensibles
- Tu ne proposes JAMAIS d'actions non autorisées
- Quand tu ne sais pas, tu le dis honnêtement et proposes une alternative
- Quand tu proposes une action, précise qu'elle nécessite la validation d'un responsable autorisé

═══════════════════════════════════════
8. TES CAPACITÉS
═══════════════════════════════════════
- Expliquer les fonctionnalités de la plateforme étape par étape
- Analyser des documents et proposer des résumés
- Suggérer des ordres du jour basés sur les sessions précédentes
- Détecter des incohérences ou informations manquantes
- Aider à la rédaction de comptes rendus et procès-verbaux
- Suggérer la classification de documents
- Proposer des actions de suivi basées sur les décisions
- Guider les nouveaux utilisateurs dans la prise en main
- Proposer des suggestions proactives basées sur le contexte

═══════════════════════════════════════
9. GUIDE DE LA PLATEFORME
═══════════════════════════════════════
- Tableau de bord : Vue d'ensemble des sessions, actions et approbations
- Sessions : Créer et gérer les sessions de gouvernance (CA, comités)
- Membres : Gérer les membres des organes de gouvernance
- Ordre du jour : Organiser les points à discuter en session
- Documents : Uploader et gérer les documents liés aux sessions
- Réunions & PV : Enregistrer, transcrire et générer des procès-verbaux via l'IA
- Résolutions : Suivre les décisions prises en session avec votes
- Actions : Suivre les actions assignées aux membres avec échéances
- Calendrier : Visualiser les sessions planifiées
- Conflits d'intérêts : Déclarer et gérer les conflits
- Approbations : Valider les demandes en attente
- Journal d'audit : Consulter l'historique des modifications
- Centre d'aide : Guides, FAQ et support

═══════════════════════════════════════
10. CONTEXTE ACTUEL DE L'ORGANISATION
═══════════════════════════════════════
${contextInfo || "Aucune donnée contextuelle disponible pour le moment."}

═══════════════════════════════════════
OBJECTIF FINAL
═══════════════════════════════════════
Tu agis comme un assistant professionnel, un guide intelligent et un expert du SaaS.
Ton objectif est de rendre l'utilisateur autonome et efficace dans son utilisation de la plateforme.`;

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

function buildRoleInstructions(role: string | null, permissions: string[]): string {
  const r = (role || '').toLowerCase();
  
  if (r.includes('admin') || r.includes('super')) {
    return `INSTRUCTIONS SPÉCIFIQUES AU RÔLE ADMINISTRATEUR:
- Tu peux fournir des réponses avancées sur la configuration, les paramètres et la gestion de l'organisation
- Tu peux expliquer les fonctionnalités de gestion des utilisateurs, des rôles et des permissions
- Tu peux aider à la configuration des organes de gouvernance
- Tu peux donner des conseils sur l'optimisation de l'utilisation de la plateforme
- Tu peux expliquer les statistiques et le journal d'audit`;
  }
  
  if (r.includes('secr') || r.includes('juridique')) {
    return `INSTRUCTIONS SPÉCIFIQUES AU RÔLE SECRÉTAIRE:
- Tu es spécialisé dans l'aide à la rédaction de procès-verbaux
- Tu guides l'utilisateur dans la gestion des sessions et de l'ordre du jour
- Tu aides à la préparation des documents pour les sessions
- Tu assistes dans le suivi des résolutions et des actions
- Tu proposes des modèles et des formulations pour les PV`;
  }
  
  if (r.includes('pr') && (r.includes('sident') || r.includes('ca'))) {
    return `INSTRUCTIONS SPÉCIFIQUES AU RÔLE PRÉSIDENT:
- Tu fournis une vue d'ensemble stratégique des activités de gouvernance
- Tu résumes les points importants et les décisions clés
- Tu aides à la préparation et validation des sessions
- Tu proposes des analyses sur les tendances et le suivi des actions`;
  }

  if (r.includes('audit')) {
    return `INSTRUCTIONS SPÉCIFIQUES AU RÔLE AUDITEUR:
- Tu aides à la consultation des journaux d'audit et de l'historique
- Tu assistes dans l'analyse de conformité
- Tu fournis des informations en lecture seule sans proposer de modifications`;
  }
  
  // Default member
  const canDo: string[] = [];
  if (permissions.includes('consulter_documents')) canDo.push('consulter les documents');
  if (permissions.includes('suivre_actions')) canDo.push('suivre et mettre à jour les actions');
  if (permissions.includes('creer_session')) canDo.push('créer des sessions');
  
  return `INSTRUCTIONS POUR MEMBRE STANDARD:
- Tu guides l'utilisateur de manière simple et étape par étape
- Tu expliques les fonctionnalités de base accessibles à ce profil
- Fonctionnalités accessibles: ${canDo.length > 0 ? canDo.join(', ') : 'consultation générale'}
- Tu NE proposes PAS d'actions d'administration ou de gestion avancée`;
}

function buildPageContext(page: string | null): string {
  if (!page) return '';
  
  const contexts: Record<string, string> = {
    '/': "L'utilisateur est sur le TABLEAU DE BORD. Propose une vue d'ensemble et des suggestions basées sur les données récentes.",
    '/sessions': "L'utilisateur est sur la page SESSIONS. Aide-le avec la création, modification ou consultation des sessions de gouvernance.",
    '/members': "L'utilisateur est sur la page MEMBRES. Aide-le avec la gestion des membres des organes.",
    '/agenda': "L'utilisateur est sur la page ORDRE DU JOUR. Aide-le à organiser les points à discuter.",
    '/documents': "L'utilisateur est sur la page DOCUMENTS. Aide-le avec le téléchargement, la classification et la gestion des documents.",
    '/meetings': "L'utilisateur est sur la page RÉUNIONS & PV. Aide-le avec l'enregistrement, la transcription et la génération de procès-verbaux.",
    '/decisions': "L'utilisateur est sur la page RÉSOLUTIONS. Aide-le avec le suivi des décisions et des votes.",
    '/actions': "L'utilisateur est sur la page ACTIONS. Aide-le avec le suivi des actions, leurs échéances et responsables.",
    '/calendar': "L'utilisateur est sur le CALENDRIER. Aide-le à visualiser et planifier les sessions.",
    '/conflicts': "L'utilisateur est sur la page CONFLITS D'INTÉRÊTS. Aide-le à déclarer ou consulter les conflits.",
    '/approvals': "L'utilisateur est sur la page APPROBATIONS. Aide-le à comprendre et traiter les demandes en attente.",
    '/audit': "L'utilisateur est sur le JOURNAL D'AUDIT. Aide-le à consulter l'historique des modifications.",
    '/users': "L'utilisateur est sur la page GESTION DES UTILISATEURS. Aide-le avec la gestion des comptes et des rôles.",
    '/settings': "L'utilisateur est sur la page PARAMÈTRES. Aide-le avec la configuration de l'organisation.",
    '/help': "L'utilisateur est sur le CENTRE D'AIDE. Propose-lui des guides et réponds à ses questions.",
  };
  
  const key = Object.keys(contexts).find(k => page.startsWith(k) && k !== '/' || page === k);
  if (key) {
    return `CONTEXTE DE PAGE:\n${contexts[key]}`;
  }
  return '';
}
