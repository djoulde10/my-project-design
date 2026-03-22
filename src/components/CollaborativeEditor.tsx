import { useCallback, useRef, useState } from "react";
import RichTextEditor from "@/components/RichTextEditor";
import CollaborationPresence from "@/components/CollaborationPresence";
import { useRealtimePresence } from "@/hooks/useRealtimePresence";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, Loader2 } from "lucide-react";

interface CollaborativeEditorProps {
  documentId: string;
  documentType: "minute" | "agenda_item" | "document";
  tableName: "minutes" | "agenda_items" | "documents";
  contentField?: string;
  content: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  minHeight?: string;
  autoSave?: boolean;
  autoSaveDelayMs?: number;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export default function CollaborativeEditor({
  documentId,
  documentType,
  tableName,
  contentField = "content",
  content,
  onChange,
  className,
  placeholder,
  minHeight = "200px",
  autoSave = true,
  autoSaveDelayMs = 2000,
}: CollaborativeEditorProps) {
  const { presenceUsers, setEditing } = useRealtimePresence({ documentId, documentType });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdateRef = useRef(false);

  const handleRemoteUpdate = useCallback((remoteContent: string) => {
    isRemoteUpdateRef.current = true;
    onChange(remoteContent);
    setTimeout(() => { isRemoteUpdateRef.current = false; }, 100);
  }, [onChange]);

  const { broadcastUpdate } = useRealtimeSync({
    documentId,
    documentType,
    onRemoteUpdate: handleRemoteUpdate,
    debounceMs: 300,
  });

  const doAutoSave = useCallback(async (html: string) => {
    if (!autoSave || !documentId) return;
    setSaveStatus("saving");
    const { error } = await supabase
      .from(tableName)
      .update({ [contentField]: html } as any)
      .eq("id", documentId);

    setSaveStatus(error ? "error" : "saved");
  }, [autoSave, documentId, tableName, contentField]);

  const handleChange = useCallback((html: string) => {
    onChange(html);

    if (isRemoteUpdateRef.current) return;

    broadcastUpdate(html);
    setEditing(true);
    setSaveStatus("unsaved");

    if (autoSave) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        doAutoSave(html);
        setEditing(false);
      }, autoSaveDelayMs);
    }
  }, [onChange, broadcastUpdate, setEditing, autoSave, autoSaveDelayMs, doAutoSave]);

  return (
    <div className="space-y-2">
      {/* Collaboration toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <CollaborationPresence users={presenceUsers} />

        <div className="flex items-center gap-1.5">
          {saveStatus === "saved" && (
            <Badge variant="outline" className="gap-1 text-xs font-normal text-emerald-600 border-emerald-200">
              <Cloud className="w-3 h-3" /> Sauvegardé
            </Badge>
          )}
          {saveStatus === "saving" && (
            <Badge variant="outline" className="gap-1 text-xs font-normal text-primary border-primary/20">
              <Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde...
            </Badge>
          )}
          {saveStatus === "unsaved" && (
            <Badge variant="outline" className="gap-1 text-xs font-normal text-amber-600 border-amber-200">
              <Cloud className="w-3 h-3" /> Modifications non sauvegardées
            </Badge>
          )}
          {saveStatus === "error" && (
            <Badge variant="outline" className="gap-1 text-xs font-normal text-destructive border-destructive/20">
              <CloudOff className="w-3 h-3" /> Erreur de sauvegarde
            </Badge>
          )}
        </div>
      </div>

      <RichTextEditor
        content={content}
        onChange={handleChange}
        className={className}
        placeholder={placeholder}
        minHeight={minHeight}
      />
    </div>
  );
}
