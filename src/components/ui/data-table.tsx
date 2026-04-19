import { ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Settings2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  /** Render the cell content. */
  render?: (row: T) => ReactNode;
  /** Optional accessor used for sorting + global search. */
  accessor?: (row: T) => string | number | null | undefined;
  /** Sortable column (default: true if accessor is provided). */
  sortable?: boolean;
  /** Hide column by default (user can toggle). */
  hiddenByDefault?: boolean;
  /** Cannot be hidden. */
  alwaysVisible?: boolean;
  /** Additional cell className. */
  className?: string;
  /** Additional header className. */
  headerClassName?: string;
  /** Width hint (Tailwind class, e.g. "w-32"). */
  width?: string;
};

export type DataTableFilter = {
  key: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
  /** Predicate evaluated against the row when value is set. */
  predicate: (row: any, value: string) => boolean;
};

type Props<T> = {
  /** Identifier used to persist user prefs in localStorage. */
  storageKey?: string;
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  /** Extracts a stable key for each row. */
  rowKey: (row: T) => string;
  /** Click on the entire row. */
  onRowClick?: (row: T) => void;
  /** Optional filters applied above the table. */
  filters?: DataTableFilter[];
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Additional fields to include in the global search (besides accessors). */
  searchableFields?: ((row: T) => string | null | undefined)[];
  /** Empty state message. */
  emptyMessage?: string;
  /** Optional toolbar slot rendered on the right side. */
  toolbar?: ReactNode;
  /** Page size options. */
  pageSizeOptions?: number[];
  /** Default page size. */
  defaultPageSize?: number;
  /** Compact rows. */
  dense?: boolean;
};

type SortState = { key: string; direction: "asc" | "desc" } | null;

function readPref<T>(key: string | undefined, fallback: T): T {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`dt:${key}`);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function writePref(key: string | undefined, value: any) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`dt:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function DataTable<T>({
  storageKey,
  data,
  columns,
  loading = false,
  rowKey,
  onRowClick,
  filters = [],
  searchPlaceholder = "Rechercher…",
  searchableFields = [],
  emptyMessage = "Aucune donnée à afficher",
  toolbar,
  pageSizeOptions = [10, 20, 50, 100],
  defaultPageSize = 20,
  dense = false,
}: Props<T>) {
  // ---- Persisted prefs ----
  const initial = readPref(storageKey, {
    sort: null as SortState,
    hiddenCols: [] as string[],
    pageSize: defaultPageSize,
  });

  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(initial.sort ?? null);
  const [hiddenCols, setHiddenCols] = useState<string[]>(
    initial.hiddenCols?.length ? initial.hiddenCols : columns.filter((c) => c.hiddenByDefault).map((c) => c.key),
  );
  const [pageSize, setPageSize] = useState<number>(initial.pageSize ?? defaultPageSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    writePref(storageKey, { sort, hiddenCols, pageSize });
  }, [storageKey, sort, hiddenCols, pageSize]);

  // ---- Filtered + searched data ----
  const filteredData = useMemo(() => {
    let rows = data;
    // Apply column filters
    for (const f of filters) {
      const v = activeFilters[f.key];
      if (v && v !== "__all__") rows = rows.filter((r) => f.predicate(r, v));
    }
    // Global search
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        for (const c of columns) {
          if (c.accessor) {
            const v = c.accessor(r);
            if (v != null && String(v).toLowerCase().includes(q)) return true;
          }
        }
        for (const fn of searchableFields) {
          const v = fn(r);
          if (v != null && String(v).toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    return rows;
  }, [data, filters, activeFilters, search, columns, searchableFields]);

  // ---- Sort ----
  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.accessor) return filteredData;
    const acc = col.accessor;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "fr", { numeric: true }) * dir;
    });
  }, [filteredData, sort, columns]);

  // ---- Pagination ----
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  const pagedData = useMemo(
    () => sortedData.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedData, safePage, pageSize],
  );

  const visibleColumns = columns.filter((c) => !hiddenCols.includes(c.key));

  const toggleSort = (key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, direction: "asc" };
      if (s.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const toggleColumn = (key: string) => {
    setHiddenCols((arr) => (arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]));
  };

  const clearAll = () => {
    setSearch("");
    setActiveFilters({});
    setSort(null);
    setPage(1);
  };

  const activeFilterCount = Object.values(activeFilters).filter((v) => v && v !== "__all__").length;
  const hasAnyActive = activeFilterCount > 0 || !!search || !!sort;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-8 h-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {filters.map((f) => (
          <Select
            key={f.key}
            value={activeFilters[f.key] ?? "__all__"}
            onValueChange={(v) => {
              setActiveFilters((prev) => ({ ...prev, [f.key]: v }));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-auto min-w-[150px]">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous · {f.label}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {typeof o.count === "number" ? ` (${o.count})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {hasAnyActive && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
            <X className="w-3.5 h-3.5 mr-1" />
            Réinitialiser
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <Settings2 className="w-3.5 h-3.5" />
                Colonnes
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Colonnes affichées</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={!hiddenCols.includes(c.key)}
                  disabled={c.alwaysVisible}
                  onCheckedChange={() => !c.alwaysVisible && toggleColumn(c.key)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const v = activeFilters[f.key];
            if (!v || v === "__all__") return null;
            const opt = f.options.find((o) => o.value === v);
            return (
              <Badge key={f.key} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
                <span className="text-xs">
                  {f.label}: {opt?.label ?? v}
                </span>
                <button
                  type="button"
                  aria-label={`Retirer le filtre ${f.label}`}
                  onClick={() =>
                    setActiveFilters((prev) => {
                      const n = { ...prev };
                      delete n[f.key];
                      return n;
                    })
                  }
                  className="hover:bg-background rounded-sm p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {visibleColumns.map((c) => {
                const sortable = c.sortable ?? !!c.accessor;
                const isSorted = sort?.key === c.key;
                return (
                  <TableHead
                    key={c.key}
                    className={cn(c.headerClassName, c.width, sortable && "cursor-pointer select-none")}
                    onClick={() => sortable && toggleSort(c.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{c.label}</span>
                      {sortable && (
                        <span className={cn("transition-opacity", isSorted ? "opacity-100" : "opacity-30")}>
                          {!isSorted && <ArrowUpDown className="w-3 h-3" />}
                          {isSorted && sort?.direction === "asc" && <ArrowUp className="w-3 h-3" />}
                          {isSorted && sort?.direction === "desc" && <ArrowDown className="w-3 h-3" />}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                  {visibleColumns.map((c) => (
                    <TableCell key={c.key} className={cn(dense ? "py-1.5" : "py-3")}>
                      <Skeleton className="h-4 w-full max-w-[200px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pagedData.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns.length} className="h-32 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer",
                    dense && "[&>td]:py-2",
                  )}
                >
                  {visibleColumns.map((c) => (
                    <TableCell key={c.key} className={cn(c.className, c.width)}>
                      {c.render ? c.render(row) : c.accessor ? String(c.accessor(row) ?? "—") : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div>
          {sortedData.length === 0
            ? "0 résultat"
            : `Affichage ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sortedData.length)} sur ${sortedData.length}`}
        </div>
        <div className="flex items-center gap-2">
          <span>Lignes :</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v))}>
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safePage === 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2">
              Page {safePage} / {totalPages}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
