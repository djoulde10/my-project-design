import { Skeleton } from "@/components/ui/skeleton";

/**
 * Unified premium page skeleton used while a route or its data are loading.
 * Mirrors the standard layout: header + stat cards + content blocks so the
 * transition to the real page is visually stable (no layout shift).
 */
export default function PageSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>

      {/* Body blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        <Skeleton className="h-64 rounded-lg" />
      </div>

      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}
