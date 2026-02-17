export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getFullLearning,
  getLearningChain,
  getLearningPropagationStatus,
} from '@/lib/data/learnings';
import { EvolutionChainTimeline } from '@/components/learnings/evolution-chain-timeline';
import { PropagationStatusTable } from '@/components/learnings/propagation-status-table';
import { PollingSubscription } from '@/components/realtime/realtime-page';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatConfidence, formatRelativeTime, formatDateTime } from '@/lib/utils';
import { IMPORTANCE_COLORS, CATEGORY_COLORS } from '@/lib/constants';

interface LearningDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LearningDetailPage({
  params,
}: LearningDetailPageProps) {
  const { id } = await params;

  const learning = await getFullLearning(id);
  if (!learning) notFound();

  const [chain, propagationStatus] = await Promise.all([
    getLearningChain(id),
    getLearningPropagationStatus(id),
  ]);

  const importanceColors = IMPORTANCE_COLORS[learning.importance];
  const categoryColor = CATEGORY_COLORS[learning.category] ?? '#6b7280';

  return (
    <>
      <PollingSubscription />
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/learnings" className="hover:text-foreground">
            Learnings
          </Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-md">
            {learning.title}
          </span>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              style={{
                borderColor: categoryColor,
                color: categoryColor,
              }}
            >
              {learning.category}
            </Badge>
            <Badge
              variant="outline"
              className={`${importanceColors.text} ${importanceColors.bg}`}
            >
              {learning.importance}
            </Badge>
            <span className="text-sm font-medium">
              Confidence: {formatConfidence(learning.confidence_score)}
            </span>
            {learning.is_superseded && (
              <Badge variant="outline" className="opacity-50">
                Superseded
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{learning.title}</h1>
        </div>

        {/* Content */}
        <Card>
          <CardContent className="pt-6">
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground bg-transparent p-0 border-0">
                {learning.content}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {learning.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Tags:</span>
              {learning.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {learning.feature_id && (
            <div>
              <span className="text-muted-foreground">Feature: </span>
              <Link
                href={`/features/${learning.feature_id}`}
                className="text-primary hover:underline"
              >
                {learning.feature_id}
              </Link>
            </div>
          )}
          {learning.phase && (
            <div>
              <span className="text-muted-foreground">Phase: </span>
              <span>{learning.phase}</span>
            </div>
          )}
          {learning.agent && (
            <div>
              <span className="text-muted-foreground">Agent: </span>
              <span>{learning.agent}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Created: </span>
            <span>{formatDateTime(learning.created_at)}</span>
          </div>
          {learning.created_by && (
            <div>
              <span className="text-muted-foreground">By: </span>
              <span>{learning.created_by}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Validations: </span>
            <span>{learning.validation_count}</span>
            {learning.last_validated_at && (
              <span className="text-muted-foreground ml-1">
                (last {formatRelativeTime(learning.last_validated_at)})
              </span>
            )}
          </div>
        </div>

        {/* Delta Summary (if evolved) */}
        {learning.delta_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Evolution Delta</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {learning.delta_summary}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Evolution Chain */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Evolution Chain ({chain.length}{' '}
              {chain.length === 1 ? 'version' : 'versions'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EvolutionChainTimeline
              chain={chain}
              currentLearningId={learning.id}
            />
          </CardContent>
        </Card>

        {/* Propagation Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Propagation Status ({propagationStatus.length}{' '}
              {propagationStatus.length === 1 ? 'target' : 'targets'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PropagationStatusTable targets={propagationStatus} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
