import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const sessionsPageQueryKey = ["page-data", "sessions"] as const;
export const auditMeetingsPageQueryKey = ["page-data", "audit-meetings"] as const;
export const membersPageQueryKey = ["page-data", "members"] as const;
export const archivesPageQueryKey = ["page-data", "archives"] as const;

export type SessionsPageData = {
  sessions: any[];
  organs: any[];
};

export type MembersPageData = {
  members: any[];
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

export async function fetchMembersPageData(): Promise<MembersPageData> {
  const [membersRes, organsRes] = await Promise.all([
    supabase.from("members").select("*, organs(name)").order("full_name"),
    supabase.from("organs").select("*"),
  ]);

  return {
    members: membersRes.data ?? [],
    organs: organsRes.data ?? [],
  };
}

export async function fetchAuditMeetingsPageData(): Promise<SessionsPageData> {
  const pageData = await fetchSessionsPageData();
  return {
    sessions: pageData.sessions.filter((s: any) => s.organs?.type === "comite_audit"),
    organs: pageData.organs.filter((o: any) => o.type === "comite_audit"),
  };
}

export async function fetchArchivesPageData(): Promise<SessionsPageData> {
  const [sessionsRes, organsRes] = await Promise.all([
    supabase.from("sessions").select("*, organs(name)").in("status", ["cloturee", "archivee"]).order("session_date", { ascending: false }),
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

  if (path === "/members") {
    return queryClient.prefetchQuery({
      queryKey: membersPageQueryKey,
      queryFn: fetchMembersPageData,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    });
  }

  if (path === "/audit-meetings") {
    return queryClient.prefetchQuery({
      queryKey: auditMeetingsPageQueryKey,
      queryFn: fetchAuditMeetingsPageData,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    });
  }

  if (path === "/archives") {
    return queryClient.prefetchQuery({
      queryKey: archivesPageQueryKey,
      queryFn: fetchArchivesPageData,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    });
  }

  return Promise.resolve();
}