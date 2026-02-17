'use client';

/**
 * CommandPalette
 *
 * Global Cmd+K command palette for quick navigation to features, learnings, and pages.
 * Uses cmdk via shadcn/ui Command component.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Brain,
  LayoutDashboard,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

interface FeatureItem {
  feature_id: string;
  feature_name: string;
  feature_status: string;
  current_phase: string;
}

interface LearningItem {
  id: string;
  title: string;
  category: string;
}

interface CommandPaletteProps {
  features: FeatureItem[];
  learnings: LearningItem[];
}

const PAGES = [
  { name: 'Health Overview', href: '/', icon: LayoutDashboard },
  { name: 'Features', href: '/features', icon: Layers },
  { name: 'Learnings', href: '/learnings', icon: Brain },
  { name: 'EVALS History', href: '/evals', icon: BarChart3 },
];

export function CommandPalette({ features, learnings }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    []
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search features, learnings, pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Pages */}
        <CommandGroup heading="Pages">
          {PAGES.map((page) => (
            <CommandItem
              key={page.href}
              value={page.name}
              onSelect={() => runCommand(() => router.push(page.href))}
            >
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{page.name}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Features */}
        {features.length > 0 && (
          <CommandGroup heading="Features">
            {features.map((f) => (
              <CommandItem
                key={f.feature_id}
                value={`${f.feature_id} ${f.feature_name}`}
                onSelect={() =>
                  runCommand(() => router.push(`/features/${f.feature_id}`))
                }
              >
                <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{f.feature_name}</span>
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {f.feature_id}
                </Badge>
                <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Learnings */}
        {learnings.length > 0 && (
          <CommandGroup heading="Learnings">
            {learnings.map((l) => (
              <CommandItem
                key={l.id}
                value={`${l.title} ${l.category}`}
                onSelect={() =>
                  runCommand(() => router.push(`/learnings/${l.id}`))
                }
              >
                <Brain className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{l.title}</span>
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {l.category}
                </Badge>
                <ArrowRight className="ml-2 h-3 w-3 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
