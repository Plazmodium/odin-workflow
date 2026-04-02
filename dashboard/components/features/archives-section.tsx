'use client';

/**
 * ArchivesSection
 *
 * Displays release handoff status plus archived specification files.
 * Always visible card panel (like other panels on feature detail page).
 */

import { useState } from 'react';
import { Archive, AlertTriangle, CheckCircle2, ExternalLink, FileText, GitBranch, GitPullRequest } from 'lucide-react';
import { cn, formatBytes, formatDate, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchiveFileModal } from './archive-file-modal';
import type { FeatureArchive, FeatureStatusResult } from '@/lib/types/database';

interface ArchivesSectionProps {
  featureId: string;
  feature: Pick<FeatureStatusResult, 'status' | 'branch_name' | 'base_branch' | 'pr_url' | 'pr_number' | 'merged_at'>;
  archive: FeatureArchive | null;
}

export function ArchivesSection({
  featureId,
  feature,
  archive,
}: ArchivesSectionProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const isCompleted = feature.status === 'COMPLETED';
  const hasPr = feature.pr_url != null;
  const isMerged = feature.merged_at != null;
  const hasFiles = archive != null && archive.files_archived.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Release</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasPr && !isMerged && (
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                PR Open
              </Badge>
            )}
            {isMerged && (
              <Badge variant="healthy" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Merged
              </Badge>
            )}
            {archive?.release_version && (
              <Badge variant="secondary" className="text-xs">
                {archive.release_version}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <GitPullRequest className="h-3.5 w-3.5" />
              Pull Request
            </div>
            {hasPr ? (
              <div className="space-y-1.5">
                <a
                  href={feature.pr_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline"
                >
                  PR #{feature.pr_number}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {isMerged ? 'Merged and recorded in workflow state.' : 'Recorded and waiting at the human merge boundary.'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pull request recorded yet.</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              Branch Handoff
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Feature:</span>{' '}
                <span className="font-mono">{feature.branch_name ?? 'Not recorded'}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Base:</span>{' '}
                <span className="font-mono">{feature.base_branch ?? 'Not recorded'}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {isMerged
                  ? `Merged ${formatRelativeTime(feature.merged_at)}.`
                  : hasPr
                    ? 'Handed off for human merge.'
                    : 'Still waiting for PR handoff.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Archive</span>
            </div>
            {archive && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {formatDate(archive.archived_at)}
                </Badge>
                {archive.total_size_bytes !== null && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {formatBytes(archive.total_size_bytes)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {!isCompleted ? (
            <p className="text-sm text-muted-foreground">Archive metadata becomes available after completion.</p>
          ) : archive == null ? (
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Feature is completed but archive metadata is missing.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm text-foreground">{archive.summary}</p>
                <p className="text-xs text-muted-foreground">
                  Archived by {archive.archived_by} on {formatDateTime(archive.archived_at)}
                </p>
              </div>

              {!hasFiles ? (
                <p className="text-sm text-muted-foreground">No files in archive.</p>
              ) : (
                <div className="space-y-1">
                  {archive.files_archived.map((fileName) => (
                    <button
                      key={fileName}
                      onClick={() => setSelectedFile(fileName)}
                      className={cn(
                        'flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md',
                        'hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        'transition-colors'
                      )}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{fileName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <ArchiveFileModal
        featureId={featureId}
        fileName={selectedFile}
        isOpen={selectedFile !== null}
        onClose={() => setSelectedFile(null)}
      />
    </Card>
  );
}
