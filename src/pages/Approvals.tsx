import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError } from "@/lib/toastHelpers";
import { CheckCircle2, XCircle, Clock, Shield, FileText, Users, Gavel } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ApprovalRequest {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  status: string;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  metadata: any;
}

const entityIcons: Record<string, typeof FileText> = {
  minute: FileText,
  document: FileText,
  session: Clock,
  member: Users,
  decision: Gavel,
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
};

export default function Approvals() {
  const { user } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ request: ApprovalRequest; action: "approved" | "rejected" } | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const canReview = hasPermission("valider_pv");

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("approval_requests")
      .select("*")
      .order("requested_at", { ascending: false });
    if (!error && data) {
      setRequests(data);
      // Fetch requester names
      const ids = [...new Set(data.map(r => r.requested_by).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name || "Utilisateur"; });
        setProfiles(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleReview = async () => {
    if (!reviewDialog || !user) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("approval_requests")
      .update({
        status: reviewDialog.action,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: comment || null,
      })
      .eq("id", reviewDialog.request.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: reviewDialog.action === "approved" ? "Demande approuvée" : "Demande rejetée" });
      fetchRequests();
    }
    setSubmitting(false);
    setReviewDialog(null);
    setComment("");
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (permLoading || loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Approbations
          </h1>
          <p className="text-muted-foreground">
            Workflow de validation des actions sensibles
            {pendingCount > 0 && <Badge variant="outline" className="ml-2">{pendingCount} en attente</Badge>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Toutes" : statusConfig[f]?.label || f}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Demandeur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Commentaire</TableHead>
                {canReview && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canReview ? 7 : 6} className="text-center text-muted-foreground py-8">
                    Aucune demande d'approbation
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(req => {
                const Icon = entityIcons[req.entity_type] || FileText;
                const sc = statusConfig[req.status] || statusConfig.pending;
                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{req.entity_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{req.action}</TableCell>
                    <TableCell>{profiles[req.requested_by] || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(req.requested_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {req.review_comment || "—"}
                    </TableCell>
                    {canReview && (
                      <TableCell className="text-right">
                        {req.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="text-emerald-600 hover:bg-emerald-50"
                              onClick={() => { setReviewDialog({ request: req, action: "approved" }); setComment(""); }}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10"
                              onClick={() => { setReviewDialog({ request: req, action: "rejected" }); setComment(""); }}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "approved" ? "Approuver la demande" : "Rejeter la demande"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <p><strong>Type :</strong> {reviewDialog?.request.entity_type}</p>
              <p><strong>Action :</strong> {reviewDialog?.request.action}</p>
              <p><strong>Demandeur :</strong> {profiles[reviewDialog?.request.requested_by || ""] || "—"}</p>
            </div>
            <Textarea
              placeholder="Commentaire (optionnel)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Annuler</Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              variant={reviewDialog?.action === "approved" ? "default" : "destructive"}
            >
              {submitting ? "..." : reviewDialog?.action === "approved" ? "Approuver" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
