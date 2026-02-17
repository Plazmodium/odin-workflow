import { Skeleton } from '@/components/ui/skeleton';

export default function LearningDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-48" />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-8 w-96" />
      </div>

      {/* Content */}
      <Skeleton className="h-48 rounded-xl" />

      {/* Metadata */}
      <Skeleton className="h-6 w-full max-w-xl" />

      {/* Evolution Chain */}
      <Skeleton className="h-40 rounded-xl" />

      {/* Propagation Status */}
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}
