import { useState, useEffect, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Reply, Trash2, Send, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  parent_id: string | null;
  mentions: string[];
  created_at: string;
  user_name?: string;
  replies?: Comment[];
}

interface CommentThreadProps {
  entityType: "minute" | "document" | "decision";
  entityId: string;
}

export default function CommentThread({ entityType, entityId }: CommentThreadProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [activeMentionField, setActiveMentionField] = useState<"main" | "reply">("main");
  const mainRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("comments" as any)
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });

    if (!data) return;

    const userIds = [...new Set((data as any[]).map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name || "Utilisateur"]));

    const enriched: Comment[] = (data as any[]).map((c: any) => ({
      ...c,
      mentions: c.mentions || [],
      user_name: profileMap.get(c.user_id) || "Utilisateur",
    }));

    // Build tree
    const roots: Comment[] = [];
    const childMap = new Map<string, Comment[]>();
    enriched.forEach((c) => {
      if (c.parent_id) {
        childMap.set(c.parent_id, [...(childMap.get(c.parent_id) || []), c]);
      } else {
        roots.push(c);
      }
    });
    roots.forEach((r) => (r.replies = childMap.get(r.id) || []));
    setComments(roots);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    const channel = supabase
      .channel(`comments:${entityType}:${entityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `entity_id=eq.${entityId}`,
        },
        (payload) => {
          const record = (payload.new || payload.old) as { entity_type?: string } | undefined;
          if (record?.entity_type === entityType) {
            fetchComments();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [entityId, entityType, fetchComments]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name")
      .then(({ data }) => setUsers((data || []).map((p) => ({ id: p.id, full_name: p.full_name || "Utilisateur" }))));
  }, []);

  const extractMentions = (text: string): string[] => {
    const mentioned: string[] = [];
    users.forEach((u) => {
      if (text.includes(`@${u.full_name}`)) mentioned.push(u.id);
    });
    return mentioned;
  };

  const sendComment = async (content: string, parentId: string | null) => {
    if (!content.trim() || !user) return;
    const mentions = extractMentions(content);

    const { error } = await supabase.from("comments" as any).insert([
      {
        entity_type: entityType,
        entity_id: entityId,
        content: content.trim(),
        user_id: user.id,
        parent_id: parentId,
        mentions,
        company_id: (await supabase.rpc("my_company_id")).data,
      },
    ] as any);

    if (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter le commentaire", variant: "destructive" });
      return;
    }

    if (parentId) {
      setReplyContent("");
      setReplyTo(null);
    } else {
      setNewComment("");
    }
    fetchComments();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("comments" as any).delete().eq("id", id);
    fetchComments();
  };

  const insertMention = (userName: string) => {
    const field = activeMentionField;
    const mention = `@${userName} `;
    if (field === "main") {
      const text = newComment.replace(/@\w*$/, "");
      setNewComment(text + mention);
      mainRef.current?.focus();
    } else {
      const text = replyContent.replace(/@\w*$/, "");
      setReplyContent(text + mention);
      replyRef.current?.focus();
    }
    setShowMentions(false);
  };

  const handleTextChange = (value: string, field: "main" | "reply") => {
    if (field === "main") setNewComment(value);
    else setReplyContent(value);

    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(" ") && afterAt.length < 30) {
        setMentionSearch(afterAt.toLowerCase());
        setShowMentions(true);
        setActiveMentionField(field);
        return;
      }
    }
    setShowMentions(false);
  };

  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(mentionSearch)
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const formatContent = (text: string) => {
    let result = text;
    users.forEach((u) => {
      result = result.replace(
        new RegExp(`@${u.full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"),
        `<span class="font-semibold text-primary">@${u.full_name}</span>`
      );
    });
    return result;
  };

  const MentionDropdown = () => {
    if (!showMentions || filteredUsers.length === 0) return null;
    return (
      <div className="absolute z-50 w-64 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-lg">
        {filteredUsers.slice(0, 8).map((u) => (
          <button
            key={u.id}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMention(u.full_name);
            }}
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{getInitials(u.full_name)}</AvatarFallback>
            </Avatar>
            {u.full_name}
          </button>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Commentaires ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New comment */}
        <div className="relative space-y-2">
          <Textarea
            ref={mainRef}
            placeholder="Ajouter un commentaire... Tapez @ pour mentionner"
            value={newComment}
            onChange={(e) => handleTextChange(e.target.value, "main")}
            className="min-h-[60px] text-sm"
          />
          {activeMentionField === "main" && <MentionDropdown />}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowMentions(true);
                setActiveMentionField("main");
                setMentionSearch("");
                const v = newComment;
                setNewComment(v + "@");
                mainRef.current?.focus();
              }}
            >
              <AtSign className="w-3.5 h-3.5 mr-1" /> Mentionner
            </Button>
            <Button size="sm" onClick={() => sendComment(newComment, null)} disabled={!newComment.trim()}>
              <Send className="w-3.5 h-3.5 mr-1" /> Envoyer
            </Button>
          </div>
        </div>

        {/* Comment list */}
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun commentaire pour le moment.</p>
        )}
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="space-y-2">
              <CommentBubble
                comment={c}
                isOwn={c.user_id === user?.id}
                onReply={() => setReplyTo(replyTo === c.id ? null : c.id)}
                onDelete={() => deleteComment(c.id)}
                getInitials={getInitials}
                formatContent={formatContent}
              />
              {/* Replies */}
              {(c.replies || []).length > 0 && (
                <div className="ml-8 border-l-2 border-muted pl-4 space-y-2">
                  {c.replies!.map((r) => (
                    <CommentBubble
                      key={r.id}
                      comment={r}
                      isOwn={r.user_id === user?.id}
                      onDelete={() => deleteComment(r.id)}
                      getInitials={getInitials}
                      formatContent={formatContent}
                    />
                  ))}
                </div>
              )}
              {/* Reply input */}
              {replyTo === c.id && (
                <div className="ml-8 relative space-y-2">
                  <Textarea
                    ref={replyRef}
                    placeholder={`Répondre à ${c.user_name}... Tapez @ pour mentionner`}
                    value={replyContent}
                    onChange={(e) => handleTextChange(e.target.value, "reply")}
                    className="min-h-[50px] text-sm"
                    autoFocus
                  />
                  {activeMentionField === "reply" && <MentionDropdown />}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                      Annuler
                    </Button>
                    <Button size="sm" onClick={() => sendComment(replyContent, c.id)} disabled={!replyContent.trim()}>
                      <Send className="w-3.5 h-3.5 mr-1" /> Répondre
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CommentBubble({
  comment,
  isOwn,
  onReply,
  onDelete,
  getInitials,
  formatContent,
}: {
  comment: Comment;
  isOwn: boolean;
  onReply?: () => void;
  onDelete: () => void;
  getInitials: (n: string) => string;
  formatContent: (t: string) => string;
}) {
  return (
    <div className="flex gap-3 group">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">
          {getInitials(comment.user_name || "U")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.user_name}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p
          className="text-sm mt-0.5 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: formatContent(comment.content) }}
        />
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onReply && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onReply}>
              <Reply className="w-3 h-3 mr-1" /> Répondre
            </Button>
          )}
          {isOwn && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="w-3 h-3 mr-1" /> Supprimer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
