import { Skeleton } from '@/components/ui/skeleton';

export default function FeatureLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-4 w-32" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Phase timeline */}
      <Skeleton className="h-16 rounded-xl" />

      {/* Tabs */}
      <Skeleton className="h-9 w-80" />

      {/* Content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      {/* Table */}
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
