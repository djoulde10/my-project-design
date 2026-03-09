import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Mic,
  ClipboardCheck,
  FolderOpen,
  FileText,
  Gavel,
  ListTodo,
  Users,
  CalendarDays,
  Filter,
  X,
} from "lucide-react";

type SearchCategory =
  | "meetings"
  | "minutes"
  | "documents"
  | "agenda_items"
  | "decisions"
  | "actions"
  | "members";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  category: SearchCategory;
  path: string;
}

const categoryConfig: Record<
  SearchCategory,
  { label: string; icon: typeof Mic; color: string }
> = {
  meetings: { label: "Réunions", icon: Mic, color: "text-violet-600" },
  minutes: { label: "Procès-verbaux", icon: ClipboardCheck, color: "text-emerald-600" },
  documents: { label: "Documents", icon: FolderOpen, color: "text-amber-600" },
  agenda_items: { label: "Ordres du jour", icon: FileText, color: "text-sky-600" },
  decisions: { label: "Résolutions", icon: Gavel, color: "text-rose-600" },
  actions: { label: "Actions", icon: ListTodo, color: "text-primary" },
  members: { label: "Membres", icon: Users, color: "text-teal-600" },
};

const allCategories = Object.keys(categoryConfig) as SearchCategory[];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategories, setActiveCategories] = useState<SearchCategory[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      const pattern = `%${q}%`;
      const cats =
        activeCategories.length > 0 ? activeCategories : allCategories;

      const promises: Promise<SearchResult[]>[] = [];

      if (cats.includes("meetings")) {
        promises.push(
          (async () => {
            let qb = supabase
              .from("meetings")
              .select("id, title, meeting_date")
              .or(`title.ilike.${pattern},transcription.ilike.${pattern}`)
              .order("meeting_date", { ascending: false })
              .limit(5);
            if (dateFrom) qb = qb.gte("meeting_date", dateFrom);
            if (dateTo) qb = qb.lte("meeting_date", dateTo);
            const { data } = await qb;
            return (data ?? []).map((r) => ({
              id: r.id,
              title: r.title,
              date: r.meeting_date ?? undefined,
              category: "meetings" as const,
              path: "/meetings",
            }));
          })()
        );
      }

      if (cats.includes("minutes")) {
        promises.push(
          (async () => {
            let qb = supabase
              .from("minutes")
              .select("id, content, created_at, sessions(title)")
              .ilike("content", pattern)
              .order("created_at", { ascending: false })
              .limit(5);
            if (dateFrom) qb = qb.gte("created_at", dateFrom);
            if (dateTo) qb = qb.lte("created_at", dateTo);
            const { data } = await qb;
            return (data ?? []).map((r: any) => ({
              id: r.id,
              title: r.sessions?.title ?? "Procès-verbal",
              subtitle: r.content?.substring(0, 80) + "…",
              date: r.created_at,
              category: "minutes" as const,
              path: "/minutes",
            }));
          })()
        );
      }

      if (cats.includes("documents")) {
        promises.push(
          (async () => {
            let qb = supabase
              .from("documents")
              .select("id, name, created_at, mime_type")
              .ilike("name", pattern)
              .order("created_at", { ascending: false })
              .limit(5);
            if (dateFrom) qb = qb.gte("created_at", dateFrom);
            if (dateTo) qb = qb.lte("created_at", dateTo);
            const { data } = await qb;
            return (data ?? []).map((r) => ({
              id: r.id,
              title: r.name,
              subtitle: r.mime_type ?? undefined,
              date: r.created_at,
              category: "documents" as const,
              path: "/documents",
            }));
          })()
        );
      }

      if (cats.includes("agenda_items")) {
        promises.push(
          (async () => {
            let qb = supabase
              .from("agenda_items")
              .select("id, title, description, created_at")
              .or(`title.ilike.${pattern},description.ilike.${pattern}`)
              .order("created_at", { ascending: false })
              .limit(5);
            if (dateFrom) qb = qb.gte("created_at", dateFrom);
            if (dateTo) qb = qb.lte("created_at", dateTo);
            const { data } = await qb;
            return (data ?? []).map((r) => ({
              id: r.id,
              title: r.title,
              subtitle: r.description?.substring(0, 80) ?? undefined,
              date: r.created_at,
              category: "agenda_items" as const,
              path: "/agenda",
            }));
          })()
        );
      }

      if (cats.includes("decisions")) {
        promises.push(
          (async () => {
            let qb = supabase
              .from("decisions")
              .select("id, numero_decision, texte, statut, created_at")
              .or(
                `texte.ilike.${pattern},numero_decision.ilike.${pattern}`
              )
              .order("created_at", { ascending: false })
              .limit(5);
            if (dateFrom) qb = qb.gte("created_at", dateFrom);
            if (dateTo) qb = qb.lte("created_at", dateTo);
            const { data } = await qb;
            return (data ?? []).map((r) => ({
              id: r.id,
              title: r.numero_decision ?? "Résolution",
              subtitle: r.texte?.substring(0, 80),
              date: r.created_at,
              category: "decisions" as const,
              path: "/decisions",
            }));
          })()
        );
      }

      if (cats.includes("actions")) {
        promises.push(
          (async () => {
            let qb = supabase
              .from("actions")
              .select("id, title, description, status, created_at")
              .or(`title.ilike.${pattern},description.ilike.${pattern}`)
              .order("created_at", { ascending: false })
              .limit(5);
            if (dateFrom) qb = qb.gte("created_at", dateFrom);
            if (dateTo) qb = qb.lte("created_at", dateTo);
            const { data } = await qb;
            return (data ?? []).map((r) => ({
              id: r.id,
              title: r.title,
              subtitle: r.description?.substring(0, 80) ?? undefined,
              date: r.created_at,
              category: "actions" as const,
              path: "/actions",
            }));
          })()
        );
      }

      if (cats.includes("members")) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("members")
              .select("id, full_name, email, quality")
              .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
              .eq("is_active", true)
              .limit(5);
            return (data ?? []).map((r) => ({
              id: r.id,
              title: r.full_name,
              subtitle: r.email ?? undefined,
              category: "members" as const,
              path: "/members",
            }));
          })()
        );
      }

      const all = (await Promise.all(promises)).flat();
      setResults(all);
      setLoading(false);
    },
    [activeCategories, dateFrom, dateTo]
  );

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const grouped = useMemo(() => {
    const map = new Map<SearchCategory, SearchResult[]>();
    for (const r of results) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return map;
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.path);
  };

  const toggleCategory = (cat: SearchCategory) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const hasFilters = activeCategories.length > 0 || dateFrom || dateTo;

  const clearFilters = () => {
    setActiveCategories([]);
    setDateFrom("");
    setDateTo("");
  };

  const formatDate = (d?: string) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 md:w-64 md:justify-start md:px-3 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline-flex">Rechercher…</span>
        <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-auto">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-3 pt-2">
          <div className="flex-1">
            <CommandInput
              placeholder="Rechercher dans toute la plateforme…"
              value={query}
              onValueChange={setQuery}
            />
          </div>
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 relative shrink-0">
                <Filter className="h-4 w-4" />
                {hasFilters && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Catégories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allCategories.map((cat) => {
                      const cfg = categoryConfig[cat];
                      const active = activeCategories.includes(cat);
                      return (
                        <Badge
                          key={cat}
                          variant={active ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleCategory(cat)}
                        >
                          {cfg.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Du</label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Au</label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={clearFilters}
                  >
                    <X className="h-3 w-3 mr-1" /> Effacer les filtres
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {hasFilters && (
          <div className="flex flex-wrap gap-1 px-4 pb-2">
            {activeCategories.map((cat) => (
              <Badge key={cat} variant="secondary" className="text-xs gap-1">
                {categoryConfig[cat].label}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleCategory(cat)} />
              </Badge>
            ))}
            {dateFrom && (
              <Badge variant="secondary" className="text-xs">
                Depuis {dateFrom}
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="text-xs">
                Jusqu'au {dateTo}
              </Badge>
            )}
          </div>
        )}

        <CommandList className="max-h-[400px]">
          {query.length < 2 && (
            <CommandEmpty>
              Tapez au moins 2 caractères pour rechercher…
            </CommandEmpty>
          )}
          {query.length >= 2 && !loading && results.length === 0 && (
            <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          )}
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Recherche en cours…
            </div>
          )}

          {Array.from(grouped.entries()).map(([cat, items], idx) => {
            const cfg = categoryConfig[cat];
            const Icon = cfg.icon;
            return (
              <div key={cat}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={
                    <span className={`flex items-center gap-1.5 ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </span>
                  }
                >
                  {items.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${r.title} ${r.subtitle ?? ""}`}
                      onSelect={() => handleSelect(r)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        {r.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {r.subtitle}
                          </p>
                        )}
                      </div>
                      {r.date && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(r.date)}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
