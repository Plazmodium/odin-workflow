'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { LearningCategory, LearningImportance } from '@/lib/types/database';

interface LearningNodeData {
  title: string;
  category: LearningCategory;
  confidence_score: number;
  importance: LearningImportance;
  is_superseded: boolean;
  feature_name: string | null;
}

function LearningNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as LearningNodeData;
  const color = CATEGORY_COLORS[nodeData.category] ?? '#71717a';
  const confidencePct = Math.round(nodeData.confidence_score * 100);

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <div
        className={`
          w-[220px] rounded-lg border bg-card p-3 shadow-md transition-all
          ${selected ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-muted-foreground'}
          ${nodeData.is_superseded ? 'opacity-50' : ''}
        `}
      >
        {/* Category badge */}
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {nodeData.category}
          </span>
          {nodeData.importance === 'HIGH' && (
            <span className="text-[10px] font-medium text-critical">HIGH</span>
          )}
        </div>

        {/* Title */}
        <p className="text-xs font-medium leading-tight line-clamp-2 mb-2">
          {nodeData.title}
        </p>

        {/* Confidence bar */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Confidence</span>
            <span className="text-[10px] font-medium tabular-nums">{confidencePct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${confidencePct}%`,
                backgroundColor:
                  confidencePct >= 80 ? '#22c55e' : confidencePct >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>

        {/* Feature tag */}
        {nodeData.feature_name && (
          <p className="mt-1.5 text-[10px] text-muted-foreground truncate">
            {nodeData.feature_name}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
    </>
  );
}

export const LearningNode = memo(LearningNodeComponent);
