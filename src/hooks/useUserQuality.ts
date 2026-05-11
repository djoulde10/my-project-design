import { useAppData } from "@/contexts/AppDataContext";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Détecte la qualité (quality) du membre lié à l'utilisateur connecté ainsi que
 * son rôle, et expose les flags utiles pour la visibilité des PV en attente.
 *
 * Logique de visibilité des PV en attente :
 * - PV CA → visibles par le PCA OU rôle "PCA" OU permission valider_pv (combinaison)
 * - PV Comité d'audit → visibles par le Président du Comité d'audit OU rôle "Président du Comité d'Audit" OU valider_pv
 */
export function useUserQuality() {
  const { quality, loading } = useAppData();
  const { roleName, hasPermission } = usePermissions();

  const canValidate = hasPermission("valider_pv");
  const isPCA = quality === "pca" || roleName === "PCA";
  const isPresidentAudit =
    quality === "president_comite_audit" || roleName === "Président du Comité d'Audit";

  // Combinaison : qualité OU rôle OU permission valider_pv
  const canSeePendingCA = isPCA || canValidate;
  const canSeePendingAudit = isPresidentAudit || canValidate;
  const canSeeAnyPending = canSeePendingCA || canSeePendingAudit;

  return {
    quality,
    loading,
    isPCA,
    isPresidentAudit,
    canSeePendingCA,
    canSeePendingAudit,
    canSeeAnyPending,
  };
}
