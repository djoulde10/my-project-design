import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, X, Send, Loader2, Sparkles, FileText, CalendarDays, ListTodo, AlertTriangle, RotateCcw, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { usePermissions } from "@/hooks/usePermissions";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const PAGE_LABELS: Record<string, string> = {
  "/": "Tableau de bord",
  "/sessions": "Sessions",
  "/members": "Membres",
  "/agenda": "Ordre du jour",
  "/documents": "Documents",
  "/meetings": "Réunions & PV",
  "/decisions": "Résolutions",
  "/actions": "Actions",
  "/calendar": "Calendrier",
  "/conflicts": "Conflits d'intérêts",
  "/approvals": "Approbations",
  "/audit": "Journal d'audit",
  "/users": "Utilisateurs",
  "/settings": "Paramètres",
  "/help": "Centre d'aide",
};

function getPageLabel(pathname: string): string {
  return PAGE_LABELS[pathname] || Object.entries(PAGE_LABELS).find(([k]) => pathname.startsWith(k) && k !== "/")?.[1] || "Plateforme";
}

function getQuickPrompts(pathname: string, roleName: string | null) {
  const base = [
    { label: "Comment ça marche ?", icon: Lightbulb, prompt: `Explique-moi comment fonctionne la section "${getPageLabel(pathname)}" étape par étape.` },
  ];

  const pagePrompts: Record<string, Array<{ label: string; icon: any; prompt: string }>> = {
    "/": [
      { label: "Résumé de la situation", icon: CalendarDays, prompt: "Fais-moi un résumé complet de la situation actuelle : sessions récentes, actions en cours, et points importants." },
      { label: "Suggestions d'actions", icon: Lightbulb, prompt: "Quelles actions me recommandes-tu de faire en priorité aujourd'hui ?" },
    ],
    "/sessions": [
      { label: "Créer une session", icon: CalendarDays, prompt: "Guide-moi étape par étape pour créer une nouvelle session." },
      { label: "Préparer un ordre du jour", icon: FileText, prompt: "Aide-moi à préparer un ordre du jour type pour la prochaine session." },
    ],
    "/meetings": [
      { label: "Rédiger un PV", icon: FileText, prompt: "Aide-moi à rédiger un procès-verbal. Quels éléments dois-je inclure ?" },
      { label: "Utiliser la transcription IA", icon: Sparkles, prompt: "Comment utiliser la transcription audio et la génération de PV par IA ?" },
    ],
    "/actions": [
      { label: "Actions en retard", icon: AlertTriangle, prompt: "Quelles sont les actions en retard ou proches de l'échéance ? Que recommandes-tu ?" },
      { label: "Suivre les actions", icon: ListTodo, prompt: "Comment bien suivre et mettre à jour les actions assignées ?" },
    ],
    "/decisions": [
      { label: "Comprendre les votes", icon: FileText, prompt: "Explique-moi comment fonctionnent les votes et les résolutions." },
    ],
    "/documents": [
      { label: "Organiser les documents", icon: FileText, prompt: "Comment bien organiser et classer les documents sur la plateforme ?" },
    ],
    "/users": [
      { label: "Gérer les rôles", icon: ListTodo, prompt: "Explique-moi comment fonctionnent les rôles et les permissions." },
    ],
  };

  const specific = pagePrompts[pathname] || pagePrompts[Object.keys(pagePrompts).find(k => pathname.startsWith(k) && k !== "/") || ""] || [
    { label: "Résumer les sessions", icon: CalendarDays, prompt: "Résume les dernières sessions et décisions importantes." },
  ];

  return [...base, ...specific].slice(0, 4);
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  const { permissions, roleName } = usePermissions();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    setIsLoading(true);
    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          context_type: "general",
          current_page: location.pathname,
          user_role: roleName,
          user_permissions: permissions,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erreur réseau" }));
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${err.error || "Erreur du service IA"}` }]);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        const current = assistantSoFar;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
          }
          return [...prev, { role: "assistant", content: current }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error("AI stream error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Erreur de connexion au service IA." }]);
    }
    setIsLoading(false);
  }, [location.pathname, roleName, permissions]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await streamChat(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
  };

  const currentPageLabel = getPageLabel(location.pathname);
  const quickPrompts = getQuickPrompts(location.pathname, roleName);

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-6rem)] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <div>
            <h3 className="font-semibold text-sm">Assistant IA</h3>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-primary-foreground/20 text-primary-foreground border-0">
                {roleName || "Membre"}
              </Badge>
              <span className="text-[9px] opacity-70">• {currentPageLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={resetChat} title="Nouvelle conversation">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Bonjour ! Je suis votre assistant IA.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Je m'adapte à votre rôle ({roleName || "Membre"}) et à la page <strong>{currentPageLabel}</strong>.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => send(qp.prompt)}
                  className="flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm hover:bg-accent transition-colors"
                >
                  <qp.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-foreground">{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="icon"
            onClick={() => send(input)}
            disabled={!input.trim() || isLoading}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          ⚠️ L'IA propose des suggestions — toute action doit être validée
        </p>
      </div>
    </div>
  );
}
