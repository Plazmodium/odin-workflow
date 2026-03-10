'use client';

/**
 * WatcherVerificationPanel
 * 
 * Displays claim verification status for watched phases (Builder, Integrator, Release).
 * Shows policy engine verdicts and LLM watcher escalations.
 */

import { useState } from 'react';
import { ChevronDown, Shield, Eye, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { cn, phaseName, formatConfidence } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { VERIFICATION_STATUS_COLORS, RISK_LEVEL_COLORS, WATCHED_PHASES } from '@/lib/constants';
import type { ClaimWithVerification } from '@/lib/types/database';
import type { ClaimsSummary } from '@/lib/data/claims';

interface WatcherVerificationPanelProps {
  claims: ClaimWithVerification[];
  summary: ClaimsSummary;
}

function VerificationIcon({ status }: { status: string }) {
  switch (status) {
    case 'PASS':
      return <CheckCircle className="h-4 w-4 text-healthy" />;
    case 'FAIL':
      return <XCircle className="h-4 w-4 text-critical" />;
    case 'NEEDS_REVIEW':
      return <Eye className="h-4 w-4 text-concerning" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function WatcherVerificationPanel({ claims, summary }: WatcherVerificationPanelProps) {
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  if (claims.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No claims recorded yet. Claims are emitted by Builder, Integrator, and Release agents.
      </p>
    );
  }

  // Group claims by phase
  const claimsByPhase = new Map<string, ClaimWithVerification[]>();
  for (const claim of claims) {
    const phase = claim.phase;
    if (!claimsByPhase.has(phase)) {
      claimsByPhase.set(phase, []);
    }
    claimsByPhase.get(phase)!.push(claim);
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">
          <span className="text-muted-foreground mr-1">Total:</span>
          {summary.total}
        </Badge>
        {summary.passed > 0 && (
          <Badge variant="outline" className="text-xs text-healthy border-healthy/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            {summary.passed} Passed
          </Badge>
        )}
        {summary.failed > 0 && (
          <Badge variant="outline" className="text-xs text-critical border-critical/30">
            <XCircle className="h-3 w-3 mr-1" />
            {summary.failed} Failed
          </Badge>
        )}
        {summary.needsReview > 0 && (
          <Badge variant="outline" className="text-xs text-concerning border-concerning/30">
            <Eye className="h-3 w-3 mr-1" />
            {summary.needsReview} Needs Review
          </Badge>
        )}
        {summary.pending > 0 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {summary.pending} Pending
          </Badge>
        )}
        {summary.watcherReviewed > 0 && (
          <Badge variant="outline" className="text-xs text-primary border-primary/30">
            <Shield className="h-3 w-3 mr-1" />
            {summary.watcherReviewed} Watcher Reviewed
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Builder, Integrator, and Release emit watched claims. High-risk or missing-evidence claims escalate from the Policy Engine to the LLM Watcher.
      </p>

      {/* Claims by phase */}
      {Array.from(claimsByPhase.entries())
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([phase, phaseClaims]) => (
          <div key={phase} className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              {phaseName(phase)} Phase
              {WATCHED_PHASES.includes(phase as typeof WATCHED_PHASES[number]) && (
                <Badge variant="outline" className="text-[9px] text-primary border-primary/30">
                  <Shield className="h-2.5 w-2.5 mr-0.5" />
                  Watched
                </Badge>
              )}
              <span className="text-muted-foreground/60">({phaseClaims.length})</span>
            </h4>

            <div className="space-y-1">
              {phaseClaims.map((claim) => {
                const isExpanded = expandedClaim === claim.id;
                const statusColors = VERIFICATION_STATUS_COLORS[claim.final_status];
                const riskColors = RISK_LEVEL_COLORS[claim.risk_level];

                return (
                  <div key={claim.id} className="border border-border rounded-md">
                    <button
                      onClick={() => setExpandedClaim(isExpanded ? null : claim.id)}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 text-left text-xs hover:bg-muted/50 transition-colors',
                        isExpanded && 'bg-muted/30'
                      )}
                    >
                      <VerificationIcon status={claim.final_status} />
                      <Badge variant="outline" className="text-[9px] font-mono">
                        {claim.claim_type}
                      </Badge>
                      <span className="flex-1 truncate text-muted-foreground">
                        {claim.claim_description}
                      </span>
                      <Badge variant="outline" className={cn('text-[9px]', riskColors.text)}>
                        {claim.risk_level}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border bg-muted/10">
                        {/* Claim details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Agent:</span>
                            <span className="ml-1 font-medium">{claim.agent_name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <span className="ml-1">{new Date(claim.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Evidence refs */}
                        {claim.evidence_refs && Object.keys(claim.evidence_refs).length > 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Evidence:</span>
                            <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto">
                              {JSON.stringify(claim.evidence_refs, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Policy verdict */}
                        <div className="flex items-start gap-2 text-xs">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <span className="font-medium">Policy Engine:</span>
                            {claim.policy_verdict ? (
                              <div className="mt-1 space-y-1">
                                <Badge
                                  variant="outline"
                                  className={cn('text-[9px]', VERIFICATION_STATUS_COLORS[claim.policy_verdict].text)}
                                >
                                  {claim.policy_verdict}
                                </Badge>
                                {claim.policy_reason && (
                                  <p className="text-muted-foreground">{claim.policy_reason}</p>
                                )}
                              </div>
                            ) : (
                              <span className="ml-1 text-muted-foreground">Not evaluated</span>
                            )}
                          </div>
                        </div>

                        {/* Watcher review */}
                        {claim.watcher_verdict && (
                          <div className="flex items-start gap-2 text-xs">
                            <Eye className="h-3.5 w-3.5 text-primary mt-0.5" />
                            <div className="flex-1">
                              <span className="font-medium">LLM Watcher:</span>
                              <div className="mt-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[9px]', VERIFICATION_STATUS_COLORS[claim.watcher_verdict].text)}
                                  >
                                    {claim.watcher_verdict}
                                  </Badge>
                                  {claim.watcher_confidence !== null && (
                                    <span className="text-muted-foreground">
                                      Confidence: {formatConfidence(claim.watcher_confidence)}
                                    </span>
                                  )}
                                </div>
                                {claim.watcher_reasoning && (
                                  <p className="text-muted-foreground">{claim.watcher_reasoning}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Escalation indicator */}
                        {claim.policy_verdict === 'NEEDS_REVIEW' && !claim.watcher_verdict && (
                          <div className="flex items-center gap-2 p-2 rounded bg-concerning/10 border border-concerning/20 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-concerning" />
                            <span className="text-concerning">
                              Escalated to LLM Watcher — awaiting review
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
