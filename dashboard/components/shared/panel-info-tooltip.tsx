'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PanelInfoTooltipProps {
  text: string;
}

export function PanelInfoTooltip({ text }: PanelInfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px]">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
