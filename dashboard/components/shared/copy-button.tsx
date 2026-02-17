'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
        'text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors',
        className
      )}
      title={`Copy ${label ?? value}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-healthy" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}
