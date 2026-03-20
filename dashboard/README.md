# Odin Dashboard (v2)

Web-based dashboard for the Odin SDD Framework. Visualizes system health, feature progress, learnings evolution, EVALS performance, **claim verification**, and **security findings** from your Supabase database.

## Pages

| Route | Description |
|-------|-------------|
| `/` | **Health Overview** — System health gauge, active alerts (with acknowledge/resolve), features table, quick stats, recent learnings |
| `/features` | **Features List** — All features with filtering (status, complexity, severity, git, health), sorting, and search |
| `/features/[id]` | **Feature Detail** — Enhanced phase timeline (11 phases, clickable/expandable), agent profiler (with watcher indicators), quality gates, blockers, **Watcher Verification panel** (v2), **Security Findings panel** (v2), EVAL breakdown, activity timeline, transition history, commits, **archives** (for completed features) |
| `/learnings` | **Learnings** — React Flow evolution graph, propagation history (display-only), skill targets, conflicts |
| `/learnings/[id]` | **Learning Detail** — Full content, evolution chain timeline, propagation status per target |
| `/evals` | **EVALS History** — Health trend chart, 7/30/90-day period comparison, agent performance, alert history, system activity timeline |

### Global Features

- **Command Palette** (`Cmd+K` / `Ctrl+K`) — Quick navigation to features, learnings, and pages
- **Auto-refresh** — 5s polling with pause/resume toggle in sidebar
- **Copy Feature ID** — One-click copy on feature detail header

## Tech Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **Tailwind CSS** + **shadcn/ui** components
- **Recharts** for charts (health gauge, agent profiler, health trend, agent performance)
- **React Flow** + **dagre** for learning evolution graph
- **react-markdown** for archive file viewer (renders spec markdown)
- **cmdk** for command palette (Cmd+K)
- **Supabase** (server-side via secret key, public storage for archives)

## Setup

### 1. Prerequisites

- Node.js 18+
- A Supabase project with Odin migrations applied (see `system/database/supabase-migrations/`)

### 2. Install Dependencies

```bash
cd system/dashboard
npm install
```

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key-here
```

> **Where to find your keys**: Supabase Dashboard → Settings → API
> - **Secret key** (under "Secret keys") — for server-side data fetching
>
> **Important**: Use the **Secret key** for `SUPABASE_SECRET_KEY`. The publishable key does not have sufficient permissions for server-side operations.
>
> **Security**: The secret key is only used server-side via `import 'server-only'`. It is never exposed to the browser.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Build for Production

```bash
npm run build
npm start
```

## Architecture

```
app/                          # Next.js App Router pages
├── page.tsx                  # Health Overview (Server Component)
├── features/
│   ├── page.tsx              # Features List (Server Component)
│   └── [id]/page.tsx         # Feature Detail (Server Component)
├── learnings/
│   ├── page.tsx              # Learnings Graph (Server Component)
│   └── [id]/page.tsx         # Learning Detail (Server Component)
├── evals/page.tsx            # EVALS History (Server Component)
├── error.tsx                 # Global error boundary
├── not-found.tsx             # Global 404
└── */loading.tsx             # Loading skeletons per route

components/
├── ui/                       # shadcn/ui primitives (badge, button, card, command, dialog, skeleton, tabs)
├── layout/                   # Sidebar (with Cmd+K hint), EmptyState
├── shared/                   # StatusBadge, StatCard, HealthGauge, PhaseBadge, RefreshEvalsButton,
│                             # CopyButton, RefreshIndicator, CommandPalette
├── realtime/                 # PollingSubscription (Client Component)
├── health/                   # AlertsPanel (with AlertActions), FeaturesTable, LearningSummary, QuickStats
├── features/                 # FeatureHeader (with CopyButton), PhaseTimelineEnhanced (11 phases, expandable),
│                             # AgentProfiler (with watcher indicators), QualityGatesTable, AuditTimeline,
│                             # ArchivesSection, ArchiveFileModal (markdown viewer with copy),
│                             # WatcherVerificationPanel (v2), SecurityFindingsPanel (v2)
├── learnings/                # LearningGraph, EvolutionChainTimeline, PropagationHistoryTable,
│                             # PropagationStatusTable, ConflictsTable, SkillPropagationQueue
└── evals/                    # HealthTrendChart, PeriodComparison, AgentPerformance, AlertHistoryTable

lib/
├── supabase.ts               # Server-only Supabase client (singleton, secret key)
├── realtime/                 # Auto-refresh infrastructure
│   ├── realtime-provider.tsx # RefreshProvider context + polling state management (with pause/resume)
│   └── use-realtime-refresh.ts # Hook: setInterval → router.refresh()
├── types/database.ts         # All TypeScript interfaces (50+, includes v2 types)
├── constants.ts              # Colors, phase names (11 phases), chart palettes, v2 constants
├── utils.ts                  # Formatting helpers (duration, score, confidence, dates)
├── data/                     # Server-side data fetching functions
│   ├── health.ts             # System health, feature overview, alerts, quick stats
│   ├── features.ts           # Feature status, durations, invocations, gates, blockers, evals
│   ├── learnings.ts          # Active learnings, propagation history, conflicts, chains
│   ├── audit.ts              # Audit log (feature-scoped and system-wide)
│   ├── evals.ts              # System health history, agent evals, alert history
│   ├── archives.ts           # Feature archive metadata from Supabase Storage
│   ├── claims.ts             # Agent claims and watcher verification (v2)
│   └── security.ts           # Security findings from Semgrep (v2)
└── actions/
    └── refresh-evals.ts      # Server Actions: refresh health, acknowledge/resolve alerts
```

### Key Design Decisions

- **Data fetching is server-side** — uses secret key via `import 'server-only'`
- **Auto-refresh via polling** — `PollingSubscription` component calls `router.refresh()` every 5s to re-fetch Server Component data without full page reload
- **Refresh indicator** — countdown timer in sidebar with pause/resume toggle
- **Client Components only for interactivity** — React Flow, Recharts, filters, tabs, polling
- **Server Actions for mutations** — refresh EVALS, acknowledge/resolve alerts
- **Light/Dark theme toggle** — CSS variables in `globals.css`, toggle in sidebar
- **`force-dynamic`** on all pages — prevents static prerendering (requires DB at runtime)

### Why Polling Instead of Supabase Realtime?

Supabase Realtime (WebSocket-based) requires the Database → Replication feature, which is currently in alpha and requires paid onboarding. Polling at 5s intervals provides equivalent UX for a monitoring dashboard with zero external dependencies.

## Deployment

Deploy to any platform that supports Next.js:

- **Vercel** (recommended) — zero config, just connect your repo
- **Netlify** — use `@netlify/plugin-nextjs`
- **Docker** — use `next start` in a container
- **Self-hosted** — `npm run build && npm start`

Set these environment variables on your platform:
- `SUPABASE_URL` (required)
- `SUPABASE_SECRET_KEY` (required)
- archived files are fetched through a server-side route; no `NEXT_PUBLIC_SUPABASE_URL` is required
