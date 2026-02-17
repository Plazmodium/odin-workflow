import { Skeleton } from '@/components/ui/skeleton';

export default function LearningsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-28" />
        ))}
      </div>

      {/* Tabs */}
      <Skeleton className="h-9 w-96" />

      {/* Graph area */}
      <Skeleton className="h-[calc(100vh-16rem)] rounded-xl" />
    </div>
  );
}
