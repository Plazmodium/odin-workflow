'use client';

/**
 * ArchiveFileModal
 *
 * Displays archived file content in a dialog with proper markdown rendering.
 * Fetches file from public Supabase storage URL.
 */

import { useEffect, useState, useCallback } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogClose,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/shared/copy-button';
import { cn } from '@/lib/utils';

interface ArchiveFileModalProps {
  featureId: string;
  fileName: string | null;
  storagePath: string;
  isOpen: boolean;
  onClose: () => void;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

function getArchiveFileUrl(storagePath: string, fileName: string): string {
  // storagePath is like "workflow-archives/DASH-001"
  // fileName is like "requirements.md"
  return `${SUPABASE_URL}/storage/v1/object/public/${storagePath}/${fileName}`;
}

export function ArchiveFileModal({
  featureId: _featureId,
  fileName,
  storagePath,
  isOpen,
  onClose,
}: ArchiveFileModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFile = useCallback(async () => {
    if (!fileName || !storagePath || !SUPABASE_URL) {
      return;
    }

    setLoading(true);
    setError(null);
    setContent(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const url = getArchiveFileUrl(storagePath, fileName);
      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        setError('File not found in archive.');
        return;
      }

      if (!response.ok) {
        setError(`Failed to load file (HTTP ${response.status}).`);
        return;
      }

      const text = await response.text();
      setContent(text);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out.');
      } else {
        setError('Failed to load file.');
      }
    } finally {
      setLoading(false);
    }
  }, [fileName, storagePath]);

  useEffect(() => {
    if (isOpen && fileName) {
      fetchFile();
    } else {
      // Reset state when modal closes
      setContent(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, fileName, fetchFile]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-medium truncate">{fileName}</h2>
          <div className="flex items-center gap-2">
            {content && (
              <CopyButton value={content} label="Copy" />
            )}
            <DialogClose asChild>
              <button
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 max-h-[60vh]">
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-4/5" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <AlertCircle className="h-8 w-8 text-critical" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={fetchFile}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                )}
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}

          {content && (
            <article className={cn(
              // Base prose styling - small size for dense spec content
              'prose prose-invert prose-xs max-w-none',
              // Headings
              'prose-headings:text-foreground prose-headings:font-semibold',
              'prose-h1:text-lg prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h1:mb-4',
              'prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2',
              'prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-2',
              // Paragraphs and text
              'prose-p:text-muted-foreground prose-p:text-xs prose-p:leading-relaxed prose-p:my-2',
              'prose-strong:text-foreground prose-strong:font-medium',
              // Lists
              'prose-li:text-xs prose-li:text-muted-foreground prose-li:my-0.5',
              'prose-ul:my-2 prose-ol:my-2',
              // Code
              'prose-code:text-primary prose-code:text-[11px] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono',
              'prose-code:before:content-none prose-code:after:content-none',
              'prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-[11px] prose-pre:p-3 prose-pre:rounded-md',
              // Tables
              'prose-table:text-xs prose-th:text-left prose-th:font-medium prose-th:py-1.5 prose-th:px-2',
              'prose-td:py-1.5 prose-td:px-2 prose-td:border-t prose-td:border-border',
              // Links
              'prose-a:text-primary prose-a:no-underline hover:prose-a:underline'
            )}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </article>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
