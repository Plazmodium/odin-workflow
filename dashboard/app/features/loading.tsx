import { Skeleton } from '@/components/ui/skeleton';

export default function FeaturesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-28" />
      </div>

      {/* Count */}
      <Skeleton className="h-4 w-32" />

      {/* Table */}
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
