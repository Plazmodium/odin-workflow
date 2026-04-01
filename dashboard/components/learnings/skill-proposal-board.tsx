import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/layout/empty-state';
import { formatRelativeTime } from '@/lib/utils';
import type { SkillProposalCandidateRecord, SkillProposalRecord } from '@/lib/types/database';
import { Sparkles } from 'lucide-react';

interface SkillProposalBoardProps {
  candidates: SkillProposalCandidateRecord[];
  proposals: SkillProposalRecord[];
}

function candidateBadge(status: SkillProposalCandidateRecord['status']) {
  return status === 'DRAFT_READY'
    ? 'bg-healthy-muted text-healthy'
    : 'bg-concerning-muted text-concerning';
}

function proposalBadge(status: SkillProposalRecord['status']) {
  switch (status) {
    case 'APPROVED':
      return 'bg-healthy-muted text-healthy';
    case 'REJECTED':
      return 'bg-critical-muted text-critical';
    case 'PUBLISHED':
      return 'bg-blue-400/10 text-blue-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function SkillProposalBoard({ candidates, proposals }: SkillProposalBoardProps) {
  if (candidates.length === 0 && proposals.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="No skill proposals yet"
        description="Repeated unresolved learning topics will appear here once the proposal queue is synced."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Candidate Queue</h3>
          <p className="text-xs text-muted-foreground">
            Repeated unresolved learning topics that may justify a generated skill draft.
          </p>
        </div>
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <Card key={candidate.topic_key}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-medium">{candidate.display_name}</h4>
                      <Badge className={candidateBadge(candidate.status)}>{candidate.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">topic key: {candidate.topic_key}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{candidate.evidence_count} evidence</div>
                    <div>{candidate.feature_count} feature(s)</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {candidate.sample_tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-1">
                  {candidate.recent_examples.map((example) => (
                    <div key={example.learning_id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{example.title}</span>
                      <span className="ml-2">{example.feature_id}</span>
                      <span className="ml-2">{formatRelativeTime(example.learning_created_at)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Draft / Approval State</h3>
          <p className="text-xs text-muted-foreground">
            Proposed skills and their current validation, approval, and publish status.
          </p>
        </div>
        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drafted skill proposals have been recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {proposals.map((proposal) => (
              <Card key={proposal.topic_key}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium">{proposal.display_name}</h4>
                        <Badge className={proposalBadge(proposal.status)}>{proposal.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {proposal.skill_category}/{proposal.skill_name}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>updated {formatRelativeTime(proposal.updated_at)}</div>
                      {proposal.published_path && <div>{proposal.published_path}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="secondary">{proposal.validation_errors.length} validation errors</Badge>
                    <Badge variant="secondary">{proposal.validation_warnings.length} warnings</Badge>
                    <Badge variant="outline">created by {proposal.created_by}</Badge>
                    {proposal.approved_by && <Badge variant="outline">approved by {proposal.approved_by}</Badge>}
                    {proposal.published_by && <Badge variant="outline">published by {proposal.published_by}</Badge>}
                  </div>

                  {proposal.decision_notes && (
                    <p className="text-xs text-muted-foreground">{proposal.decision_notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
