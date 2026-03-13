import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { showSuccess, showError } from "@/lib/toastHelpers";

interface Attendee {
  id: string;
  member_id: string;
  is_present: boolean | null;
  proxy_member_id: string | null;
  members: { full_name: string; quality: string } | null;
  proxy?: { full_name: string } | null;
}

interface Member {
  id: string;
  full_name: string;
  quality: string;
  organ_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  organId: string;
  onUpdated: () => void;
}

export default function SessionAttendeeManager({ open, onOpenChange, sessionId, organId, onUpdated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [addMemberId, setAddMemberId] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const [attRes, memRes] = await Promise.all([
      supabase
        .from("session_attendees")
        .select("*, members!session_attendees_member_id_fkey(full_name, quality)")
        .eq("session_id", sessionId),
      supabase
        .from("members")
        .select("id, full_name, quality, organ_id")
        .eq("is_active", true),
    ]);
    setAttendees(attRes.data ?? []);
    setAllMembers(memRes.data ?? []);
  };

  useEffect(() => {
    if (open) fetchData();
  }, [open, sessionId]);

  const attendeeIds = new Set(attendees.map((a) => a.member_id));

  // Members from the same organ not yet added
  const organMembers = allMembers.filter((m) => m.organ_id === organId && !attendeeIds.has(m.id));
  // Members from other organs (invités)
  const otherMembers = allMembers.filter((m) => m.organ_id !== organId && !attendeeIds.has(m.id));
  const availableMembers = [...organMembers, ...otherMembers];

  // Members available as proxy (all active members not already the attendee)
  const proxyOptions = allMembers.filter((m) => attendeeIds.has(m.id) || true);

  const addAttendee = async () => {
    if (!addMemberId) return;
    setLoading(true);
    const { error } = await supabase.from("session_attendees").insert([{
      session_id: sessionId,
      member_id: addMemberId,
    }]);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Participant ajouté" }); setAddMemberId(""); }
    await fetchData();
    onUpdated();
    setLoading(false);
  };

  const removeAttendee = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from("session_attendees").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "Participant retiré" });
    await fetchData();
    onUpdated();
    setLoading(false);
  };

  const togglePresence = async (id: string, current: boolean | null) => {
    const { error } = await supabase.from("session_attendees").update({ is_present: !current }).eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    await fetchData();
    onUpdated();
  };

  const setProxy = async (attendeeId: string, proxyMemberId: string | null) => {
    const { error } = await supabase.from("session_attendees").update({
      proxy_member_id: proxyMemberId || null,
    }).eq("id", attendeeId);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    await fetchData();
    onUpdated();
  };

  const presentCount = attendees.filter((a) => a.is_present).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gérer les participants
          </DialogTitle>
        </DialogHeader>

        {/* Add member */}
        <div className="flex items-center gap-2">
          <Select value={addMemberId} onValueChange={setAddMemberId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Ajouter un participant..." />
            </SelectTrigger>
            <SelectContent>
              {organMembers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Membres de l'organe</div>
                  {organMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </>
              )}
              {otherMembers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Invités (autres organes)</div>
                  {otherMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </>
              )}
              {availableMembers.length === 0 && (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">Tous les membres sont déjà ajoutés</div>
              )}
            </SelectContent>
          </Select>
          <Button onClick={addAttendee} disabled={!addMemberId || loading} size="sm">
            <UserPlus className="w-4 h-4 mr-1" />Ajouter
          </Button>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{attendees.length} participant(s)</span>
          <Badge variant="outline" className="text-xs">{presentCount} présent(s)</Badge>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Qualité</TableHead>
              <TableHead>Présent</TableHead>
              <TableHead>Procuration</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendees.map((att) => (
              <TableRow key={att.id}>
                <TableCell className="font-medium">{att.members?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{att.members?.quality ?? "—"}</Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={!!att.is_present}
                    onCheckedChange={() => togglePresence(att.id, att.is_present)}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={att.proxy_member_id ?? "none"}
                    onValueChange={(v) => setProxy(att.id, v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-8 text-xs w-40">
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {allMembers
                        .filter((m) => m.id !== att.member_id)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAttendee(att.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {attendees.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Aucun participant ajouté.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
