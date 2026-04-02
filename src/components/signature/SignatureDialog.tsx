import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import SignaturePad from "./SignaturePad";
import { showSuccess, showError } from "@/lib/toastHelpers";

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  entityLabel: string;
  onSigned: () => void;
}

export default function SignatureDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
  onSigned,
}: SignatureDialogProps) {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<"drawn" | "uploaded">("drawn");
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);

  const handleSignatureChange = (data: string | null, type: "drawn" | "uploaded") => {
    setSignatureData(data);
    setSignatureType(type);
    setConfirmed(false);
  };

  const handleSign = async () => {
    if (!user || !signatureData || !confirmed) return;
    setSigning(true);

    try {
      // Insert signature record
      const { error: sigError } = await supabase.from("signatures").insert({
        entity_type: entityType,
        entity_id: entityId,
        signed_by: user.id,
        company_id: companyId,
        signature_image: signatureData,
        signature_type: signatureType,
      } as any);

      if (sigError) {
        showError(sigError, "Impossible de signer le document");
        setSigning(false);
        return;
      }

      // If it's a minute, update status to 'signe'
      if (entityType === "minute") {
        const { error: updateError } = await supabase
          .from("minutes")
          .update({ pv_status: "signe", signed_at: new Date().toISOString() } as any)
          .eq("id", entityId);

        if (updateError) {
          showError(updateError, "Erreur lors de la mise à jour du statut");
          setSigning(false);
          return;
        }
      }

      showSuccess("document_signed");
      onOpenChange(false);
      onSigned();
    } catch (err) {
      showError(err, "Erreur inattendue lors de la signature");
    } finally {
      setSigning(false);
    }
  };

  const reset = () => {
    setSignatureData(null);
    setConfirmed(false);
    setSigning(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Signature électronique
          </DialogTitle>
          <DialogDescription>
            Vous vous apprêtez à signer officiellement le document suivant. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">Document</p>
            <p className="text-sm text-muted-foreground">{entityLabel}</p>
            <Badge variant="outline" className="mt-1">
              {entityType === "minute" ? "Procès-verbal" : "Document"}
            </Badge>
          </div>

          {/* Signature pad */}
          <SignaturePad onSignatureChange={handleSignatureChange} />

          {/* Preview */}
          {signatureData && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Aperçu de la signature</Label>
              <div className="border rounded-lg p-3 bg-background flex justify-center">
                <img src={signatureData} alt="Aperçu signature" className="max-h-20 object-contain" />
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Une fois signé, le document sera verrouillé et ne pourra plus être modifié. Assurez-vous d'avoir relu le contenu attentivement.
            </p>
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm-sign"
              checked={confirmed}
              onCheckedChange={(c) => setConfirmed(!!c)}
              disabled={!signatureData}
            />
            <Label htmlFor="confirm-sign" className="text-sm cursor-pointer">
              Je confirme avoir lu le document et souhaite apposer ma signature officielle
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={signing}>
            Annuler
          </Button>
          <Button
            onClick={handleSign}
            disabled={!signatureData || !confirmed || signing}
          >
            {signing ? "Signature en cours..." : "Signer le document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
