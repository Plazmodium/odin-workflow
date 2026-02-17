---
name: nextjs-dev
description: Next.js development — App Router, Server Components, Server Actions, data fetching patterns, and deployment
category: frontend
version: "14.x"
depends_on:
  - react-patterns
compatible_with:
  - tailwindcss
  - supabase
  - prisma-orm
  - typescript
---

# Next.js Development

## Overview

Next.js 14 with App Router provides Server Components by default, Server Actions for mutations, and streaming for progressive rendering. Prefer the App Router for all new projects.

## Project Structure

```text
app/
├── layout.tsx          # Root layout (wraps all pages)
├── page.tsx            # Home page (Server Component by default)
├── error.tsx           # Error boundary ('use client' required)
├── not-found.tsx       # 404 page
├── loading.tsx         # Loading skeleton (shown during streaming)
├── globals.css         # Global styles
├── features/
│   └── [id]/
│       └── page.tsx    # Dynamic route
└── api/
    └── route.ts        # API route handler

components/
├── ui/                 # Primitives (button, card, etc.)
├── layout/             # Sidebar, header, footer
└── shared/             # Reusable across pages

lib/
├── data/               # Server-side data fetching functions
├── actions/            # Server Actions ('use server')
├── types/              # TypeScript interfaces
└── utils.ts            # Formatting helpers
```

## Core Patterns

### Server Components (default)

```typescript
// app/page.tsx — Server Component (no 'use client' directive)
export const dynamic = 'force-dynamic'; // Required when fetching from DB

import { getData } from '@/lib/data/my-data';

export default async function Page() {
  const data = await getData(); // Runs on server only

  return <div>{data.title}</div>;
}
```

### Client Components (opt-in)

```typescript
// components/counter.tsx
'use client'; // Required for interactivity, hooks, browser APIs

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### Server Actions (mutations)

```typescript
// lib/actions/my-actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createItem(formData: FormData) {
  const name = formData.get('name') as string;
  // ... insert into DB
  revalidatePath('/');
}
```

### Server-Only Data Fetching (Supabase pattern)

```typescript
// lib/supabase.ts
import 'server-only'; // Prevents accidental client import

import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  return createClient(
    process.env.SUPABASE_URL!,       // No NEXT_PUBLIC_ prefix
    process.env.SUPABASE_SECRET_KEY!, // Secret key, server-only
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        // CRITICAL: Bypass Next.js 14 fetch cache to prevent stale data.
        // Without this, Supabase responses are cached by Next.js's Data Cache.
        fetch: (input, init) =>
          fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  );
}
```

## Auto-Refresh via Polling

When WebSocket-based realtime isn't available (e.g., Supabase Realtime requires paid onboarding), use polling with `router.refresh()` to re-fetch Server Component data without full page reload.

### Architecture

```text
RefreshProvider (layout.tsx)     — React Context tracking polling state
  └── PollingSubscription        — Zero-UI Client Component, activates polling
        └── usePollingRefresh    — Hook: setInterval → router.refresh()
  └── ConnectionStatus           — Green dot "Auto-refresh" indicator
```

### Hook: usePollingRefresh

```typescript
// lib/realtime/use-polling-refresh.ts
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_INTERVAL_MS = 5000;

export function usePollingRefresh(intervalMs = DEFAULT_INTERVAL_MS) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      router.refresh(); // Re-fetches Server Component data
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs, router]);
}
```

### Zero-UI Component (place as sibling in Server Component pages)

```typescript
// components/polling-subscription.tsx
'use client';

import { usePollingRefresh } from '@/lib/realtime/use-polling-refresh';

export function PollingSubscription({ intervalMs }: { intervalMs?: number }) {
  usePollingRefresh(intervalMs);
  return null; // Renders nothing — side effect only
}
```

### Usage in Server Component pages

```typescript
// app/page.tsx
import { PollingSubscription } from '@/components/polling-subscription';
import { getData } from '@/lib/data/my-data';

export default async function Page() {
  const data = await getData();

  return (
    <>
      <PollingSubscription />
      <div>{/* ...server-rendered content auto-refreshes every 5s... */}</div>
    </>
  );
}
```

> **Why sibling, not wrapper?** Wrapping an `async` Server Component return with a `'use client'` component breaks Next.js module resolution for dynamic routes (`[id]`). Always place Client Components as siblings using `<> ... </>`.

## Build Gotchas (Next.js 14)

1. **`next.config.ts` not supported** in Next.js 14.2 — use `.mjs` or `.js`
2. **`@apply border-border` fails** unless shadcn/ui color tokens are defined in `tailwind.config.ts` (need `border: 'hsl(var(--border))'` etc.)
3. **Static prerendering fails** when pages use `import 'server-only'` Supabase client — add `export const dynamic = 'force-dynamic'` to all data-fetching pages
4. **Hydration mismatch** — `typeof window !== 'undefined'` evaluates differently server vs client. Defer browser checks to `useEffect`:

   ```typescript
   const [isClient, setIsClient] = useState(false);
   useEffect(() => setIsClient(true), []);
   ```

## Data Cache Gotcha: Stale Supabase Data (CRITICAL)

Next.js 14 patches the global `fetch` API to add `cache: 'force-cache'` by default. Libraries that use `fetch` internally (like `@supabase/supabase-js`) will have their responses cached by Next.js's **Data Cache**, even when pages have `export const dynamic = 'force-dynamic'`.

**Symptoms**: Pages show old data despite the database having correct values. `router.refresh()` and hard refresh don't help. Direct SQL queries return correct results.

**Why `force-dynamic` isn't enough**: `force-dynamic` opts out of the **Full Route Cache** (no static prerendering) but does NOT bypass the **Data Cache** for individual `fetch` calls. The Supabase client's internal fetch calls inherit the default `cache: 'force-cache'` behavior.

**Fix**: Override the Supabase client's `fetch` to pass `cache: 'no-store'`:

```typescript
// lib/supabase.ts
client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, cache: 'no-store' }),
  },
});
```

**Layouts are especially vulnerable**: `app/layout.tsx` doesn't support `export const dynamic`. Async Server Components in layouts (e.g., a command palette that fetches features) are always subject to fetch caching unless the client itself opts out.

**See also**: database/supabase (client setup with `cache: 'no-store'`)
**Confidence**: 1.00 | **Validated by**: integration-test | **Source**: DASH-003

## Best Practices

1. **Server Components by default** — only add `'use client'` when you need hooks, event handlers, or browser APIs
2. **`import 'server-only'`** on any module that uses secrets — prevents accidental client bundling
3. **No `NEXT_PUBLIC_` for secrets** — only use the prefix for values safe to expose in the browser
4. **`force-dynamic` on DB pages** — prevents build-time prerendering that requires a live database
5. **Server Actions for mutations** — use `'use server'` functions instead of API routes for form submissions
6. **Parallel data fetching** — use `Promise.all()` in Server Components to fetch data concurrently
7. **Loading skeletons** — add `loading.tsx` per route for instant navigation feedback
8. **Error boundaries** — add `error.tsx` per route (must be `'use client'`)
9. **Virtual DOM** - Do not manipulate the real DOM. This breaks the oneway data data flow that React is built on. Use 'useState'.
