import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { History, Eye, RotateCcw, GitCompare } from "lucide-react";

interface MinuteVersionHistoryProps {
  minuteId: string;
  currentContent: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (content: string) => void;
}

interface Version {
  id: string;
  version_number: number;
  content: string | null;
  summary: string | null;
  modified_by: string | null;
  created_at: string;
  modifier_name?: string;
}

export default function MinuteVersionHistory({
  minuteId,
  currentContent,
  open,
  onOpenChange,
  onRestore,
}: MinuteVersionHistoryProps) {
  
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    if (open && minuteId) fetchVersions();
  }, [open, minuteId]);

  const fetchVersions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("minute_versions")
      .select("*")
      .eq("minute_id", minuteId)
      .order("version_number", { ascending: false });

    if (error) {
      showError(error, "Impossible de charger l'historique des versions");
      setLoading(false);
      return;
    }

    // Fetch modifier names
    const userIds = [...new Set((data ?? []).map((v: any) => v.modified_by).filter(Boolean))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name || "Utilisateur"]));
    }

    setVersions(
      (data ?? []).map((v: any) => ({
        ...v,
        modifier_name: v.modified_by ? profileMap[v.modified_by] || "Utilisateur" : "Système",
      }))
    );
    setLoading(false);
  };

  const handleRestore = (version: Version) => {
    if (!version.content) return;
    onRestore(version.content);
    onOpenChange(false);
    showSuccess("pv_version_restored");
  };

  const computeDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const maxLen = Math.max(oldLines.length, newLines.length);
    const diffs: { type: "same" | "added" | "removed"; text: string }[] = [];

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      if (oldLine === newLine) {
        diffs.push({ type: "same", text: newLine || "" });
      } else {
        if (oldLine !== undefined) diffs.push({ type: "removed", text: oldLine });
        if (newLine !== undefined) diffs.push({ type: "added", text: newLine });
      }
    }
    return diffs;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique des versions
          </DialogTitle>
        </DialogHeader>

        {viewingVersion ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setViewingVersion(null); setCompareMode(false); }}>
                  ← Retour
                </Button>
                <Badge variant="outline">Version {viewingVersion.version_number}</Badge>
                {compareMode && <Badge variant="secondary">Mode comparaison</Badge>}
              </div>
              <div className="flex gap-2">
                {!compareMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompareMode(true)}
                    disabled={!currentContent || !viewingVersion.content}
                  >
                    <GitCompare className="w-4 h-4 mr-1" />Comparer
                  </Button>
                )}
                <Button size="sm" onClick={() => handleRestore(viewingVersion)} disabled={!viewingVersion.content}>
                  <RotateCcw className="w-4 h-4 mr-1" />Restaurer
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[50vh] rounded-md border p-4">
              {compareMode && currentContent && viewingVersion.content ? (
                <div className="space-y-0 text-sm font-mono">
                  {computeDiff(viewingVersion.content, currentContent).map((d, i) => (
                    <div
                      key={i}
                      className={
                        d.type === "added"
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2 py-0.5"
                          : d.type === "removed"
                          ? "bg-destructive/10 text-destructive px-2 py-0.5 line-through"
                          : "px-2 py-0.5 text-muted-foreground"
                      }
                    >
                      <span className="mr-2 text-xs opacity-50">
                        {d.type === "added" ? "+" : d.type === "removed" ? "−" : " "}
                      </span>
                      {d.text || "\u00A0"}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{viewingVersion.content || "Contenu vide"}</p>
              )}
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="h-[50vh]">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Chargement...</p>
            ) : versions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune version enregistrée</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{v.version_number}</Badge>
                        <span className="text-sm font-medium">{v.modifier_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {v.summary && <p className="text-xs text-muted-foreground italic">{v.summary}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewingVersion(v)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRestore(v)} disabled={!v.content}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
