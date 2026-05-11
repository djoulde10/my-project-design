import { useAppData } from "@/contexts/AppDataContext";

export function useCompanyId() {
  const { companyId } = useAppData();
  return companyId;
}
