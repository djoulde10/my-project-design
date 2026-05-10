import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showInfo } from "@/lib/toastHelpers";
import { toast } from "sonner";

export type RecordingStatus = "idle" | "recording" | "paused";

export interface RecordingMeta {
  title: string;
  sessionId?: string;
  templateId?: string;
  mode?: "professionnel" | "simplifie";
}

interface RecordingContextValue {
  status: RecordingStatus;
  startedAt: number | null;
  elapsedMs: number;
  transcript: string;
  partialText: string;
  meta: RecordingMeta | null;
  start: (meta: RecordingMeta) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<{ transcript: string; meta: RecordingMeta | null }>;
  reset: () => void;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [partialText, setPartialText] = useState("");
  const [meta, setMeta] = useState<RecordingMeta | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedAccum, setPausedAccum] = useState(0); // ms accumulated while paused
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const committedRef = useRef("");

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => setPartialText(data.text || ""),
    onCommittedTranscript: (data) => {
      const newText = data.text || "";
      committedRef.current += (committedRef.current ? " " : "") + newText;
      setTranscript(committedRef.current);
      setPartialText("");
    },
  });

  // Tick elapsed time
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => {
      if (startedAt) setElapsedMs(Date.now() - startedAt - pausedAccum);
    }, 500);
    return () => clearInterval(id);
  }, [status, startedAt, pausedAccum]);

  // Warn before unload while active
  useEffect(() => {
    if (status === "idle") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Une écoute IA est en cours. Quitter va arrêter l'enregistrement.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  const start = useCallback(async (m: RecordingMeta): Promise<boolean> => {
    if (status !== "idle") {
      showError(null, "Une écoute est déjà en cours");
      return false;
    }
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error(error?.message || "Token indisponible");
      committedRef.current = "";
      setTranscript("");
      setPartialText("");
      setMeta(m);
      setPausedAccum(0);
      setPausedAt(null);
      setStartedAt(Date.now());
      setElapsedMs(0);
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      setStatus("recording");
      showInfo("Écoute IA démarrée", "L'enregistrement continue même si vous changez de page.");
      return true;
    } catch (e: any) {
      showError(e, "Impossible de démarrer l'écoute");
      setStatus("idle");
      setMeta(null);
      return false;
    }
  }, [scribe, status]);

  const pause = useCallback(async () => {
    if (status !== "recording") return;
    try { await scribe.disconnect(); } catch { /* ignore */ }
    setPausedAt(Date.now());
    setStatus("paused");
    setPartialText("");
    showInfo("Écoute en pause", "La transcription reprendra quand vous appuierez sur Reprendre.");
  }, [scribe, status]);

  const resume = useCallback(async () => {
    if (status !== "paused") return;
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error(error?.message || "Token indisponible");
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
      if (pausedAt) setPausedAccum((p) => p + (Date.now() - pausedAt));
      setPausedAt(null);
      setStatus("recording");
      showInfo("Écoute reprise");
    } catch (e: any) {
      showError(e, "Impossible de reprendre l'écoute");
    }
  }, [scribe, status, pausedAt]);

  const stop = useCallback(async () => {
    try { await scribe.disconnect(); } catch { /* ignore */ }
    const finalTranscript = committedRef.current;
    const finalMeta = meta;
    setStatus("idle");
    setPartialText("");
    setStartedAt(null);
    setPausedAt(null);
    setPausedAccum(0);
    setElapsedMs(0);
    if (finalTranscript) toast.success("Enregistrement terminé");
    return { transcript: finalTranscript, meta: finalMeta };
  }, [scribe, meta]);

  const reset = useCallback(() => {
    committedRef.current = "";
    setTranscript("");
    setPartialText("");
    setMeta(null);
  }, []);

  return (
    <RecordingContext.Provider
      value={{ status, startedAt, elapsedMs, transcript, partialText, meta, start, pause, resume, stop, reset }}
    >
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecording must be used within RecordingProvider");
  return ctx;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}