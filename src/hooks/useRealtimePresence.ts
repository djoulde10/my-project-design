import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  isEditing: boolean;
  lastActive: string;
  color: string;
}

const PRESENCE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

interface UseRealtimePresenceOptions {
  documentId: string;
  documentType: "minute" | "agenda_item" | "document";
}

export function useRealtimePresence({ documentId, documentType }: UseRealtimePresenceOptions) {
  const { user } = useAuth();
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch own profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user?.id]);

  useEffect(() => {
    if (!user || !documentId || !profile) return;

    const channelName = `presence:${documentType}:${documentId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          userId: string;
          fullName: string;
          avatarUrl?: string;
          isEditing: boolean;
          lastActive: string;
        }>();
        const users: PresenceUser[] = [];
        for (const [key, presences] of Object.entries(state)) {
          if (key === user.id) continue;
          const p = presences[0];
          if (p) {
            users.push({
              userId: p.userId,
              fullName: p.fullName,
              avatarUrl: p.avatarUrl,
              isEditing: p.isEditing,
              lastActive: p.lastActive,
              color: getColorForUser(p.userId),
            });
          }
        }
        setPresenceUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: user.id,
            fullName: profile.full_name || user.email || "Utilisateur",
            avatarUrl: profile.avatar_url,
            isEditing: false,
            lastActive: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user?.id, documentId, documentType, profile]);

  const setEditing = useCallback(async (isEditing: boolean) => {
    if (!channelRef.current || !user || !profile) return;
    await channelRef.current.track({
      userId: user.id,
      fullName: profile.full_name || user.email || "Utilisateur",
      avatarUrl: profile.avatar_url,
      isEditing,
      lastActive: new Date().toISOString(),
    });
  }, [user, profile]);

  return { presenceUsers, setEditing };
}
