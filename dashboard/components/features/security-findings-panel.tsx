'use client';

/**
 * SecurityFindingsPanel
 * 
 * Displays security findings from the Reviewer phase (Semgrep SAST).
 * Shows severity breakdown, blocking findings, and resolution status.
 */

import { useState } from 'react';
import { ChevronDown, ShieldAlert, CheckCircle, XCircle, AlertTriangle, FileCode, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { FINDING_SEVERITY_COLORS } from '@/lib/constants';
import type { SecurityFinding, FindingSeverity } from '@/lib/types/database';
import type { SecuritySummary } from '@/lib/data/security';

interface SecurityFindingsPanelProps {
  findings: SecurityFinding[];
  summary: SecuritySummary;
}

const SEVERITY_ORDER: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function SeverityIcon({ severity }: { severity: FindingSeverity }) {
  const colors = FINDING_SEVERITY_COLORS[severity];
  switch (severity) {
    case 'CRITICAL':
      return <XCircle className={cn('h-4 w-4', colors.text)} />;
    case 'HIGH':
      return <AlertTriangle className={cn('h-4 w-4', colors.text)} />;
    case 'MEDIUM':
      return <ShieldAlert className={cn('h-4 w-4', colors.text)} />;
    default:
      return <ShieldAlert className={cn('h-4 w-4', colors.text)} />;
  }
}

export function SecurityFindingsPanel({ findings, summary }: SecurityFindingsPanelProps) {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  if (findings.length === 0) {
    return (
      <div className="py-4 text-center space-y-2">
        <CheckCircle className="h-8 w-8 text-healthy mx-auto" />
        <p className="text-sm text-muted-foreground">
          No security findings. Code passed Semgrep analysis.
        </p>
      </div>
    );
  }

  // Filter findings based on showResolved toggle
  const visibleFindings = showResolved
    ? findings
    : findings.filter((f) => !f.resolved);

  // Group by severity
  const findingsBySeverity = new Map<FindingSeverity, SecurityFinding[]>();
  for (const severity of SEVERITY_ORDER) {
    findingsBySeverity.set(severity, []);
  }
  for (const finding of visibleFindings) {
    findingsBySeverity.get(finding.severity)!.push(finding);
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">
          <span className="text-muted-foreground mr-1">Total:</span>
          {summary.total}
        </Badge>
        {summary.blocking > 0 && (
          <Badge variant="outline" className="text-xs text-critical border-critical/30">
            <XCircle className="h-3 w-3 mr-1" />
            {summary.blocking} Blocking
          </Badge>
        )}
        {summary.unresolved > 0 && (
          <Badge variant="outline" className="text-xs text-concerning border-concerning/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {summary.unresolved} Open
          </Badge>
        )}
        {summary.resolved > 0 && (
          <Badge variant="outline" className="text-xs text-healthy border-healthy/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            {summary.resolved} Resolved
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Reviewer findings come from Semgrep. Only unresolved HIGH and CRITICAL findings block progression; lower severities remain visible for follow-up.
      </p>

      {/* Severity breakdown */}
      <div className="flex flex-wrap gap-2">
        {SEVERITY_ORDER.map((severity) => {
          const stats = summary.bySeverity[severity];
          if (stats.total === 0) return null;
          const colors = FINDING_SEVERITY_COLORS[severity];
          return (
            <Badge
              key={severity}
              variant="outline"
              className={cn('text-[10px]', colors.text, colors.border)}
            >
              {severity} open: {stats.total - stats.resolved}/{stats.total}
            </Badge>
          );
        })}
      </div>

      {/* Show/hide resolved toggle */}
      {summary.resolved > 0 && (
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showResolved ? 'Hide' : 'Show'} {summary.resolved} resolved finding{summary.resolved !== 1 ? 's' : ''}
        </button>
      )}

      {/* Blocking warning */}
      {summary.blocking > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-critical/10 border border-critical/20 text-xs">
          <XCircle className="h-4 w-4 text-critical shrink-0" />
          <div>
            <span className="font-medium text-critical">
              {summary.blocking} blocking finding{summary.blocking !== 1 ? 's' : ''} must be resolved
            </span>
            <p className="text-muted-foreground mt-0.5">
              HIGH and CRITICAL severity findings block the workflow. Resolve or defer with justification.
            </p>
          </div>
        </div>
      )}

      {/* Findings by severity */}
      {SEVERITY_ORDER.map((severity) => {
        const severityFindings = findingsBySeverity.get(severity) || [];
        if (severityFindings.length === 0) return null;

        const colors = FINDING_SEVERITY_COLORS[severity];

        return (
          <div key={severity} className="space-y-2">
            <h4 className={cn('text-xs font-medium flex items-center gap-2', colors.text)}>
              <SeverityIcon severity={severity} />
              {severity}
              <span className="text-muted-foreground">({severityFindings.length})</span>
            </h4>

            <div className="space-y-1">
              {severityFindings.map((finding) => {
                const isExpanded = expandedFinding === finding.id;

                return (
                  <div
                    key={finding.id}
                    className={cn(
                      'border rounded-md',
                      colors.border,
                      finding.resolved && 'opacity-60'
                    )}
                  >
                    <button
                      onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 text-left text-xs hover:bg-muted/50 transition-colors',
                        isExpanded && 'bg-muted/30'
                      )}
                    >
                      {finding.resolved ? (
                        <CheckCircle className="h-3.5 w-3.5 text-healthy shrink-0" />
                      ) : (
                        <SeverityIcon severity={severity} />
                      )}
                      <span className="flex-1 truncate">{finding.message}</span>
                      {finding.rule_id && (
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {finding.rule_id}
                        </Badge>
                      )}
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border bg-muted/10 text-xs">
                        {/* File location */}
                        {finding.file_path && (
                          <div className="flex items-center gap-2">
                            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-muted-foreground">
                              {finding.file_path}
                              {finding.line_number && `:${finding.line_number}`}
                              {finding.column_number && `:${finding.column_number}`}
                            </span>
                          </div>
                        )}

                        {/* Code snippet */}
                        {finding.snippet && (
                          <div>
                            <span className="text-muted-foreground">Code:</span>
                            <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto font-mono">
                              {finding.snippet}
                            </pre>
                          </div>
                        )}

                        {/* Tool info */}
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span>Tool: <span className="font-medium text-foreground">{finding.tool}</span></span>
                          {finding.rule_id && (
                            <a
                              href={`https://semgrep.dev/r/${finding.rule_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              View rule <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {/* Resolution info */}
                        {finding.resolved && (
                          <div className="p-2 rounded bg-healthy/10 border border-healthy/20 space-y-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-3.5 w-3.5 text-healthy" />
                              <span className="text-healthy font-medium">Resolved</span>
                              {finding.resolved_by && (
                                <span className="text-muted-foreground">
                                  by {finding.resolved_by}
                                </span>
                              )}
                            </div>
                            {finding.resolution_note && (
                              <p className="text-muted-foreground ml-5">
                                {finding.resolution_note}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
