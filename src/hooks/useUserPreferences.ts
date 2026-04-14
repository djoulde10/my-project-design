import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface UserColorPreferences {
  couleur_principale: string | null;
  couleur_secondaire: string | null;
  couleur_accent: string | null;
  couleur_fond: string | null;
  couleur_sidebar: string | null;
  couleur_carte: string | null;
}

const EMPTY: UserColorPreferences = {
  couleur_principale: null,
  couleur_secondaire: null,
  couleur_accent: null,
  couleur_fond: null,
  couleur_sidebar: null,
  couleur_carte: null,
};

export function useUserPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserColorPreferences>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) { setPrefs(EMPTY); setLoading(false); return; }

    supabase
      .from("user_preferences")
      .select("couleur_principale, couleur_secondaire, couleur_accent, couleur_fond, couleur_sidebar, couleur_carte")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            couleur_principale: (data as any).couleur_principale ?? null,
            couleur_secondaire: (data as any).couleur_secondaire ?? null,
            couleur_accent: (data as any).couleur_accent ?? null,
            couleur_fond: (data as any).couleur_fond ?? null,
            couleur_sidebar: (data as any).couleur_sidebar ?? null,
            couleur_carte: (data as any).couleur_carte ?? null,
          });
        }
        setLoading(false);
      });
  }, [user, version]);

  async function savePrefs(colors: UserColorPreferences) {
    if (!user) return false;
    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: user.id,
        ...colors,
      } as any, { onConflict: "user_id" });

    if (!error) {
      setPrefs(colors);
      setVersion((v) => v + 1);
    }
    return !error;
  }

  function invalidate() {
    setVersion((v) => v + 1);
  }

  return { prefs, loading, savePrefs, invalidate };
}
