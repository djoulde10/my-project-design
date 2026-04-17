import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to Postgres changes on a given table and calls `onChange`
 * each time a row is INSERTed, UPDATEd or DELETEd. Use this to make
 * the UI refresh instantly without manually reloading the page.
 *
 * @example
 *   useRealtimeTable("sessions", fetchSessions);
 */
export function useRealtimeTable(
  table: string,
  onChange: () => void,
  filter?: string
) {
  // Keep latest callback in a ref so the channel doesn't re-subscribe each render
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const channel = supabase
      .channel(`rt-${table}-${filter ?? "all"}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) } as any,
        () => cbRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}

/**
 * Subscribe to several tables at once with a single callback.
 */
export function useRealtimeTables(tables: string[], onChange: () => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const channels = tables.map((t) =>
      supabase
        .channel(`rt-multi-${t}-${Math.random().toString(36).slice(2, 7)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: t } as any,
          () => cbRef.current()
        )
        .subscribe()
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}
