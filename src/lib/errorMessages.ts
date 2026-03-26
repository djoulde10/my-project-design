/**
 * Centralized error translation utility.
 * Converts raw technical / Supabase / Postgres errors into user-friendly
 * French messages while logging the original error for administrators.
 */

// ── Pattern-based translations ────────────────────────────────────────────────
interface ErrorPattern {
  /** Regex or substring matched against error.message (case-insensitive) */
  test: RegExp;
  /** User-facing message */
  message: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // ── Auth ──
  { test: /invalid login credentials/i, message: "Identifiants incorrects. Veuillez vérifier votre e-mail et votre mot de passe." },
  { test: /email not confirmed/i, message: "Votre adresse e-mail n'a pas encore été confirmée. Veuillez vérifier votre boîte de réception." },
  { test: /user already registered/i, message: "Cet utilisateur existe déjà dans l'organisation." },
  { test: /password.*too short|password.*at least/i, message: "Le mot de passe est trop court. Il doit contenir au moins 6 caractères." },
  { test: /email.*already.*use|duplicate.*email/i, message: "Cette adresse e-mail est déjà utilisée par un autre compte." },
  { test: /signup.*disabled/i, message: "Les inscriptions sont actuellement désactivées. Contactez votre administrateur." },
  { test: /rate limit|too many requests/i, message: "Trop de tentatives. Veuillez patienter quelques instants avant de réessayer." },
  { test: /token.*expired|jwt expired/i, message: "Votre session a expiré. Veuillez vous reconnecter." },
  { test: /not authorized|permission denied|insufficient.*privilege/i, message: "Vous n'avez pas les droits nécessaires pour effectuer cette action. Contactez votre administrateur si vous pensez que c'est une erreur." },

  // ── RLS / Row-Level Security ──
  { test: /new row violates row-level security/i, message: "Vous n'avez pas l'autorisation d'effectuer cette opération. Vérifiez vos droits d'accès ou contactez votre administrateur." },
  { test: /row-level security/i, message: "Accès refusé. Vous n'avez pas les permissions nécessaires pour cette action." },
  { test: /violates row-level security policy for table "sessions"/i, message: "Vous n'avez pas le droit de créer ou modifier des sessions. Contactez votre administrateur pour obtenir les droits nécessaires." },
  { test: /violates row-level security policy for table "members"/i, message: "Vous n'avez pas le droit de gérer les membres. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "decisions"/i, message: "Vous n'avez pas le droit de gérer les résolutions. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "documents"/i, message: "Vous n'avez pas le droit de gérer les documents. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "minutes"/i, message: "Vous n'avez pas le droit de gérer les procès-verbaux. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "actions"/i, message: "Vous n'avez pas le droit de gérer les actions. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "approval_requests"/i, message: "Vous n'avez pas le droit de gérer les approbations. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "conflict_of_interests"/i, message: "Vous n'avez pas le droit de gérer les conflits d'intérêts. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "signatures"/i, message: "Vous n'avez pas le droit de signer ce document. Contactez votre administrateur." },
  { test: /violates row-level security policy for table "profiles"/i, message: "Vous n'avez pas le droit de modifier ce profil. Contactez votre administrateur." },
  { test: /violates row-level security policy/i, message: "Vous n'avez pas les permissions nécessaires pour cette opération. Contactez votre administrateur." },

  // ── Database constraint violations ──
  { test: /unique.*violation|duplicate key|already exists/i, message: "Cet élément existe déjà. Veuillez vérifier les informations saisies." },
  { test: /foreign key.*violation/i, message: "Cette opération n'est pas possible car des éléments liés existent encore." },
  { test: /not-null.*violation|null value/i, message: "Certains champs obligatoires ne sont pas remplis. Merci de vérifier les informations saisies." },
  { test: /check.*violation/i, message: "Les données saisies ne respectent pas les règles de validation. Veuillez les corriger." },

  // ── Custom business rules (from triggers) ──
  { test: /limite atteinte.*pca|président.*déjà.*actif/i, message: "Un Président du Conseil d'Administration est déjà actif pour cet organe. Vous ne pouvez pas en ajouter un second." },
  { test: /limite atteinte.*président.*comité/i, message: "Un Président du Comité est déjà actif pour ce mandat. Vous ne pouvez pas en ajouter un second." },
  { test: /limite atteinte.*secrétariat/i, message: "Le nombre maximum de Secrétariats juridiques actifs est atteint pour cet organe." },
  { test: /limite atteinte/i, message: "Le nombre maximum autorisé a été atteint pour cette fonction." },

  // ── Storage ──
  { test: /payload too large|file.*too.*large|exceeded.*size/i, message: "Le fichier est trop volumineux. Veuillez réduire sa taille et réessayer." },
  { test: /bucket.*not found/i, message: "L'espace de stockage est temporairement indisponible. Veuillez réessayer." },
  { test: /mime type|file type/i, message: "Ce type de fichier n'est pas pris en charge. Veuillez utiliser un format autorisé." },

  // ── Network / Server ──
  { test: /fetch.*failed|network.*error|ERR_NETWORK/i, message: "Impossible de se connecter au serveur. Vérifiez votre connexion Internet et réessayez." },
  { test: /500|internal server error/i, message: "Une erreur interne s'est produite. Merci de réessayer dans quelques instants." },
  { test: /502|bad gateway/i, message: "Le serveur est temporairement indisponible. Veuillez réessayer dans quelques instants." },
  { test: /503|service unavailable/i, message: "Le service est en cours de maintenance. Veuillez réessayer plus tard." },
  { test: /504|gateway timeout/i, message: "Le serveur met trop de temps à répondre. Veuillez réessayer." },
  { test: /timeout|timed out/i, message: "La requête a pris trop de temps. Veuillez réessayer." },

  // ── Edge Functions ──
  { test: /TTS failed/i, message: "La synthèse vocale a échoué. Veuillez réessayer ou vérifier votre quota de synthèse vocale." },
  { test: /Transcription failed/i, message: "La transcription audio a échoué. Vérifiez le fichier audio et réessayez." },
  { test: /edge function.*error|function.*invocation/i, message: "Le traitement a échoué. Veuillez réessayer dans quelques instants." },
  { test: /quota.*exceeded|limit.*reached/i, message: "Le quota de requêtes est atteint. Veuillez réessayer plus tard." },
];

// ── Fallback message ──────────────────────────────────────────────────────────
const DEFAULT_MESSAGE = "Une erreur inattendue s'est produite. Merci de réessayer. Si le problème persiste, contactez votre administrateur.";

/**
 * Translate a technical error into a user-friendly French message.
 * The original error is always logged to the console for debugging.
 */
export function translateError(error: unknown): string {
  // Always log the raw error for admin debugging
  console.error("[GovBoard Error]", error);

  const msg = extractMessage(error);

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test.test(msg)) {
      return pattern.message;
    }
  }

  return DEFAULT_MESSAGE;
}

/**
 * Extract a string message from various error shapes.
 */
function extractMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as Record<string, any>;
    return e.message || e.error_description || e.error || e.msg || JSON.stringify(error);
  }
  return String(error);
}

// ── Context-aware success messages ────────────────────────────────────────────
export const SUCCESS_MESSAGES = {
  // Sessions
  session_created: "La session a été créée avec succès. Les membres concernés seront notifiés.",
  session_updated: "La session a été mise à jour.",
  session_status_updated: "Le statut de la session a été mis à jour.",
  session_deleted: "La session a été supprimée.",

  // Members
  member_created: "Le membre a été ajouté avec succès.",
  member_updated: "Les informations du membre ont été mises à jour.",
  member_deactivated: "Le membre a été désactivé.",

  // Attendees
  attendee_added: "Le participant a été ajouté à la session.",
  attendee_removed: "Le participant a été retiré de la session.",

  // Documents
  document_uploaded: "Le document a été ajouté avec succès.",
  document_deleted: "Le document a été supprimé.",

  // Minutes / PV
  pv_created: "Le procès-verbal a été créé.",
  pv_updated: "Le procès-verbal a été enregistré.",
  pv_status_updated: "Le statut du procès-verbal a été mis à jour.",
  pv_generated: "Le procès-verbal a été généré. Relisez et modifiez le contenu avant de l'enregistrer.",
  pv_version_restored: "La version a été restaurée. N'oubliez pas de sauvegarder.",

  // Decisions / Resolutions
  decision_created: "La résolution a été enregistrée.",
  decision_signed: "La résolution a été signée avec succès.",

  // Actions
  action_created: "L'action a été créée.",
  action_updated: "Le statut de l'action a été mis à jour.",

  // Users
  user_created: "L'utilisateur a été créé avec succès.",
  user_updated: "Le profil de l'utilisateur a été mis à jour.",
  user_suspended: "L'utilisateur a été suspendu.",
  user_activated: "L'utilisateur a été activé.",
  user_linked: "Le compte utilisateur a été lié au membre avec succès.",

  // Approvals
  approval_approved: "La demande a été approuvée.",
  approval_rejected: "La demande a été rejetée.",

  // Conflicts
  conflict_declared: "Le conflit d'intérêt a été déclaré.",
  conflict_resolved: "Le conflit d'intérêt a été résolu.",
  conflict_waived: "Le conflit d'intérêt a été levé.",

  // AI
  ai_analysis_complete: "L'analyse IA est terminée. Les suggestions sont prêtes à être examinées.",
  transcription_started: "La transcription est en cours…",
  board_packet_generated: "Le Board Packet a été généré avec succès.",

  // Permissions
  permission_added: "La permission a été ajoutée.",
  permission_updated: "La permission a été mise à jour.",
  permission_removed: "La permission a été supprimée.",

  // API Keys
  api_key_created: "La clé API a été créée avec succès.",
  api_key_revoked: "La clé API a été révoquée.",

  // Generic
  saved: "Les modifications ont été enregistrées.",
  deleted: "L'élément a été supprimé.",
  copied: "Copié dans le presse-papiers.",
} as const;

export type SuccessKey = keyof typeof SUCCESS_MESSAGES;
