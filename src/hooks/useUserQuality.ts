import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
  const { user } = useAuth();
  const { roleName, hasPermission } = usePermissions();
  const [quality, setQuality] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setQuality(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("quality, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setQuality((data as any)?.quality ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
