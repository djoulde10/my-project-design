import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

interface SignatureDisplayProps {
  entityType: string;
  entityId: string;
}

export default function SignatureDisplay({ entityType, entityId }: SignatureDisplayProps) {
  const [signature, setSignature] = useState<any>(null);
  const [signerName, setSignerName] = useState<string>("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("signatures")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("signed_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setSignature(data[0]);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data[0].signed_by)
          .single();
        setSignerName(profile?.full_name || "Signataire");
      }
    };
    fetch();
  }, [entityType, entityId]);

  if (!signature) return null;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          Document signé
        </span>
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
          Officiel
        </Badge>
      </div>

      {(signature as any).signature_image && (
        <div className="flex justify-center bg-background rounded-md p-2 border">
          <img
            src={(signature as any).signature_image}
            alt="Signature officielle"
            className="max-h-16 object-contain"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>Signé par : <strong className="text-foreground">{signerName}</strong></span>
        <span>Le : <strong className="text-foreground">{new Date(signature.signed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></span>
      </div>
    </div>
  );
}
