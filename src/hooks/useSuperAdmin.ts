import { useAppData } from "@/contexts/AppDataContext";

export function useSuperAdmin() {
  const { isSuperAdmin, loading } = useAppData();
  return { isSuperAdmin, loading };
}
