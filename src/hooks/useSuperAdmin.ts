import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useSuperAdmin() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .then(({ data }) => {
        setIsSuperAdmin((data ?? []).length > 0);
        setLoading(false);
      });
  }, [user]);

  return { isSuperAdmin, loading };
}
