import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeSyncOptions {
  documentId: string;
  documentType: "minute" | "agenda_item" | "document";
  onRemoteUpdate: (content: string, senderId: string) => void;
  debounceMs?: number;
}

export function useRealtimeSync({
  documentId,
  documentType,
  onRemoteUpdate,
  debounceMs = 500,
}: UseRealtimeSyncOptions) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    if (!user || !documentId) return;

    const channelName = `sync:${documentType}:${documentId}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "content_update" }, ({ payload }) => {
        if (payload.senderId !== user.id) {
          onRemoteUpdate(payload.content, payload.senderId);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user?.id, documentId, documentType]);

  const broadcastUpdate = useCallback((content: string) => {
    if (!channelRef.current || !user) return;
    if (content === lastSentRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastSentRef.current = content;
      channelRef.current?.send({
        type: "broadcast",
        event: "content_update",
        payload: { content, senderId: user.id, timestamp: Date.now() },
      });
    }, debounceMs);
  }, [user, debounceMs]);

  return { broadcastUpdate };
}
