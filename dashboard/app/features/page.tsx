export const dynamic = 'force-dynamic';

import { getAllFeaturesSummary } from '@/lib/data/health';
import { FeaturesListView } from '@/components/features/features-list-view';
import { PollingSubscription } from '@/components/realtime/realtime-page';

export default async function FeaturesPage() {
  const features = await getAllFeaturesSummary();

  return (
    <>
      <PollingSubscription />
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Features</h1>
          <p className="text-sm text-muted-foreground">
            All features tracked by Odin with filtering, sorting, and search.
          </p>
        </div>

        {/* Features List */}
        <FeaturesListView features={features} />
      </div>
    </>
  );
}
