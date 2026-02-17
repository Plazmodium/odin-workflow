'use client';

/**
 * ArchivesSection
 *
 * Displays archived specification files for completed features.
 * Always visible card panel (like other panels on feature detail page).
 */

import { useState } from 'react';
import { FileText, Archive } from 'lucide-react';
import { cn, formatBytes, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchiveFileModal } from './archive-file-modal';
import type { FeatureArchive, FeatureStatus } from '@/lib/types/database';

interface ArchivesSectionProps {
  featureId: string;
  featureStatus: FeatureStatus;
  archive: FeatureArchive | null;
}

export function ArchivesSection({
  featureId,
  featureStatus,
  archive,
}: ArchivesSectionProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const isCompleted = featureStatus === 'COMPLETED';
  const hasFiles = archive && archive.files_archived.length > 0;

  // Handle trailing slash in storage_path
  const storagePath = archive?.storage_path?.replace(/\/$/, '') ?? '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Archives</CardTitle>
          </div>
          {isCompleted && archive && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {formatDate(archive.archived_at)}
              </Badge>
              {archive.total_size_bytes !== null && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {formatBytes(archive.total_size_bytes)}
                </Badge>
              )}
              {archive.release_version && (
                <Badge variant="secondary" className="text-xs">
                  {archive.release_version}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!isCompleted ? (
          <p className="text-sm text-muted-foreground">Archives available after completion</p>
        ) : !archive ? (
          <p className="text-sm text-muted-foreground">No archives available</p>
        ) : !hasFiles ? (
          <p className="text-sm text-muted-foreground">No files in archive</p>
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
      </CardContent>

      <ArchiveFileModal
        featureId={featureId}
        fileName={selectedFile}
        storagePath={storagePath}
        isOpen={selectedFile !== null}
        onClose={() => setSelectedFile(null)}
      />
    </Card>
  );
}
