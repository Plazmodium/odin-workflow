import Link from 'next/link';
import { Brain } from 'lucide-react';
import { EmptyState } from '@/components/layout/empty-state';

export default function LearningNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <EmptyState
        icon={<Brain className="h-10 w-10" />}
        title="Learning not found"
        description="This learning may have been superseded or doesn't exist."
      >
        <Link
          href="/learnings"
          className="text-sm text-primary hover:underline mt-2 inline-block"
        >
          Back to Learnings
        </Link>
      </EmptyState>
    </div>
  );
}
