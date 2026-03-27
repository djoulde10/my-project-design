/**
 * ═══════════════════════════════════════════════════════════════
 * CHECKLIST D'INTÉGRATION — NOUVELLE FONCTIONNALITÉ
 * ═══════════════════════════════════════════════════════════════
 *
 * Ce fichier documente les étapes OBLIGATOIRES à suivre lors de
 * l'ajout de toute nouvelle fonctionnalité dans GovBoard.
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 1. BASE DE DONNÉES                                         │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Créer la table avec company_id pour le multi-tenant      │
 * │ □ Ajouter les politiques RLS (SELECT, INSERT, UPDATE, DEL) │
 * │ □ Ajouter le trigger updated_at si applicable              │
 * │ □ Ajouter le trigger audit_trigger_func()                  │
 * │   → AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW          │
 * │ □ Ajouter des triggers de notification si pertinent        │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 2. PERMISSIONS (RBAC)                                      │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Créer la permission dans la table `permissions`          │
 * │   (ex: 'gerer_xxx', 'consulter_xxx')                       │
 * │ □ Ajouter le type dans usePermissions.ts (PermissionName)  │
 * │ □ Utiliser user_has_permission() dans les politiques RLS   │
 * │ □ Vérifier les permissions côté client avec usePermissions │
 * │ □ Assigner la permission aux rôles par défaut              │
 * │   via role_permissions                                     │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 3. JOURNAL D'AUDIT                                         │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Trigger audit automatique via audit_trigger_func()       │
 * │ □ Ajouter l'entité dans entityLabels (AuditLog.tsx)        │
 * │ □ Vérifier que les champs sensibles sont exclus du log     │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 4. FEATURE FLAGS                                           │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Si la fonctionnalité est activable par organisation :    │
 * │   → Ajouter un feature_key dans feature_flags              │
 * │   → Vérifier le flag côté client avant affichage           │
 * │   → Ajouter dans AdminFeatureFlags pour le Super Admin     │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 5. GESTION DES ERREURS                                     │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Ajouter les patterns RLS dans errorMessages.ts           │
 * │ □ Ajouter les messages de succès dans SUCCESS_MESSAGES     │
 * │ □ Utiliser translateError() pour toutes les erreurs        │
 * │ □ Utiliser toastHelpers pour les notifications utilisateur │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 6. ASSISTANT IA                                            │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Ajouter la page dans buildPageContext()                  │
 * │   (ai-assistant/index.ts)                                  │
 * │ □ Mettre à jour le GUIDE DE LA PLATEFORME dans le prompt   │
 * │ □ Ajouter des suggestions contextuelles dans AIAssistant   │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 7. SUPER ADMIN                                             │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Si supervision globale nécessaire :                      │
 * │   → Ajouter une vue dans /admin                            │
 * │   → Ajouter des statistiques dans AdminAnalytics           │
 * │   → Ajouter dans AdminMonitoring si applicable             │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 8. NOTIFICATIONS                                           │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Créer un trigger SECURITY DEFINER pour notifications     │
 * │ □ Notifier les utilisateurs concernés (participants, etc.) │
 * │ □ Intégrer dans NotificationBell si nécessaire             │
 * └────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ 9. TESTS & VALIDATION                                      │
 * ├────────────────────────────────────────────────────────────┤
 * │ □ Vérifier que le RLS fonctionne (accès inter-entreprise)  │
 * │ □ Vérifier que l'audit log capture bien les événements     │
 * │ □ Vérifier que les permissions bloquent les non-autorisés  │
 * │ □ Vérifier la gestion des erreurs utilisateur              │
 * └────────────────────────────────────────────────────────────┘
 */

export const INTEGRATION_STEPS = [
  "database_schema",
  "rls_policies",
  "audit_trigger",
  "permissions",
  "feature_flag",
  "error_messages",
  "ai_assistant",
  "super_admin",
  "notifications",
] as const;

export type IntegrationStep = typeof INTEGRATION_STEPS[number];
