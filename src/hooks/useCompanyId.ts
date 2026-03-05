import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useCompanyId() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCompanyId(null);
      return;
    }
    supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setCompanyId(data?.company_id ?? null);
      });
  }, [user]);

  return companyId;
}
