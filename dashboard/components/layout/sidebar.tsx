'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Brain, BarChart3, Layers, Zap, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RefreshIndicator } from '@/components/shared/refresh-indicator';
import { SoundToggle } from '@/components/sound/sound-toggle';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { usePlatform } from '@/lib/hooks/use-platform';

const navItems = [
  { href: '/', label: 'Health Overview', icon: Activity },
  { href: '/features', label: 'Features', icon: Layers },
  { href: '/learnings', label: 'Learnings', icon: Brain },
  { href: '/evals', label: 'EVALS History', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { modifierKey, modifierSymbol } = usePlatform();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-surface">
      {/* Logo - clickable, navigates to Health Overview */}
      <Link
        href="/"
        className="flex h-14 items-center gap-2 border-b border-border px-4 hover:bg-accent/30 transition-colors"
      >
        <Zap className="h-5 w-5 text-yellow-400" />
        <span className="text-sm font-bold tracking-tight text-yellow-400">ODIN</span>
        <span className="text-xs text-muted-foreground">Dashboard</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-yellow-400/50 -rotate-12 ml-0.5 select-none">beta</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {/* Command Palette hint */}
        <button
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', [modifierKey]: true })
            );
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors mt-2"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">{modifierSymbol}</span>K
          </kbd>
        </button>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        <RefreshIndicator />
        <SoundToggle />
        <ThemeToggle />
      </div>
    </aside>
  );
}
