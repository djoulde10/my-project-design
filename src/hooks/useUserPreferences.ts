import { useAppData, type UserColorPreferences } from "@/contexts/AppDataContext";

export function useUserPreferences() {
  const { prefs, loading, savePrefs, invalidatePrefs: invalidate } = useAppData();
  return { prefs, loading, savePrefs, invalidate };
}

export type { UserColorPreferences };
