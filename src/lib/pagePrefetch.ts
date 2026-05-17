import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const sessionsPageQueryKey = ["page-data", "sessions"] as const;

export type SessionsPageData = {
  sessions: any[];
  organs: any[];
};

export async function fetchSessionsPageData(): Promise<SessionsPageData> {
  const [sessionsRes, organsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*, organs(name, type)")
      .order("session_date", { ascending: false }),
    supabase.from("organs").select("*"),
  ]);

  return {
    sessions: sessionsRes.data ?? [],
    organs: organsRes.data ?? [],
  };
}

export function prefetchRouteData(path: string, queryClient: QueryClient) {
  if (path === "/sessions") {
    return queryClient.prefetchQuery({
      queryKey: sessionsPageQueryKey,
      queryFn: fetchSessionsPageData,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    });
  }

  return Promise.resolve();
}