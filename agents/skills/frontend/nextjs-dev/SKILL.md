---
name: nextjs-dev
description: Next.js development — App Router, Server Components, Server Actions, caching, data fetching patterns, and deployment
category: frontend
version: "14.x - 16.x"
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

Next.js 14+ with App Router provides Server Components by default, Server Actions for mutations, and streaming for progressive rendering. Next.js 16 introduces Cache Components (`use cache` directive) and makes request-bound APIs async. Prefer the App Router for all new projects.

## Project Structure

```text
app/
├── layout.tsx          # Root layout (wraps all pages)
├── page.tsx            # Home page (Server Component by default)
├── error.tsx           # Error boundary ('use client' required)
├── not-found.tsx       # 404 page
├── loading.tsx         # Loading skeleton (shown during streaming)
├── globals.css         # Global styles
├── (admin)/            # Route group (no URL segment)
│   └── dashboard/
├── _internal/          # Private folder (opted out of routing)
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

**Route Groups**: Use parentheses (e.g., `(admin)`) to group routes without affecting the URL path.

**Private Folders**: Prefix with `_` (e.g., `_internal`) to opt out of routing and signal implementation details.

**Feature Folders**: For large apps, group by feature (e.g., `app/dashboard/`, `app/auth/`).

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

## Server and Client Component Integration

**Never use `next/dynamic` with `{ ssr: false }` inside a Server Component.** This is not supported and will cause a build/runtime error.

**Correct Approach:**

1. Move all client-only logic/UI into a dedicated Client Component (with `'use client'` at the top)
2. Import and use that Client Component directly in the Server Component
3. No need for `next/dynamic` — just import the Client Component normally

```typescript
// Server Component
import DashboardNavbar from '@/components/DashboardNavbar';

export default async function DashboardPage() {
  // ...server logic...
  return (
    <>
      <DashboardNavbar /> {/* This is a Client Component */}
      {/* ...rest of server-rendered page... */}
    </>
  );
}
```

**Why**: Server Components cannot use client-only features or dynamic imports with SSR disabled. Client Components can be rendered inside Server Components, but not the other way around.

## Next.js 16+ Async Request APIs

In Next.js 16, request-bound APIs are async in the App Router:

```typescript
// Next.js 16+ — cookies, headers, draftMode are async
import { cookies, headers } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const headersList = await headers();
  // ...
}
```

**Route props may be Promises**: `params` and `searchParams` may be Promises in Server Components. Prefer awaiting them:

```typescript
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // ...
}
```

**Dynamic rendering**: Accessing request data (cookies/headers/searchParams) opts the route into dynamic behavior. Read them intentionally and isolate dynamic parts behind `Suspense` boundaries when appropriate.

## API Routes (Route Handlers)

**Location**: Place API routes in `app/api/` (e.g., `app/api/users/route.ts`).

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ?? '10';
  
  // ... fetch data
  return NextResponse.json({ users: [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // ... validate and create
  return NextResponse.json({ id: 'new-id' }, { status: 201 });
}
```

**Dynamic Segments**: Use `[param]` for dynamic routes (e.g., `app/api/users/[id]/route.ts`).

**Validation**: Always validate input with libraries like `zod`.

**Performance Note**: Do NOT call your own Route Handlers from Server Components (e.g., `fetch('/api/...')`). Extract shared logic into `lib/` modules and call directly to avoid extra server hops.

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

## Caching & Revalidation

### Next.js 14.x (fetch cache)

Next.js 14 patches global `fetch` with `cache: 'force-cache'` by default. Override per-fetch or per-client to prevent stale data. See "Data Cache Gotcha" below.

### Next.js 16.x (Cache Components)

Enable in `next.config.*`:

```javascript
// next.config.mjs
export default {
  cacheComponents: true,
};
```

Use the `use cache` directive to opt a component/function into caching:

```typescript
'use cache';

export async function getCachedData() {
  // This result will be cached
  return await fetchExpensiveData();
}
```

**Cache tagging and lifetimes**:

```typescript
import { cacheTag, cacheLife } from 'next/cache';

export async function getProducts() {
  'use cache';
  cacheTag('products');      // Associate with tag
  cacheLife('hours');        // Set cache lifetime
  return await fetchProducts();
}
```

**Revalidation**:

```typescript
import { revalidateTag } from 'next/cache';

// In a Server Action
export async function refreshProducts() {
  'use server';
  revalidateTag('products', 'max'); // stale-while-revalidate
}
```

Prefer `revalidateTag(tag, 'max')` for most cases. Use `updateTag(...)` inside Server Actions when you need immediate consistency.

## Build Gotchas (Next.js 14+)

1. **`next.config.ts` not supported** in Next.js 14.2 — use `.mjs` or `.js`

2. **`@apply border-border` fails** unless shadcn/ui color tokens are defined in `tailwind.config.ts` (need `border: 'hsl(var(--border))'` etc.)

3. **Static prerendering fails** when pages use `import 'server-only'` Supabase client — add `export const dynamic = 'force-dynamic'` to all data-fetching pages

4. **Hydration mismatch** — `typeof window !== 'undefined'` evaluates differently server vs client. Defer browser checks to `useEffect`:

   ```typescript
   const [isClient, setIsClient] = useState(false);
   useEffect(() => setIsClient(true), []);
   ```

5. **`next/dynamic` with `{ ssr: false }` in Server Components** — Not supported. Move client-only logic to a dedicated Client Component and import it directly.

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

## Naming Conventions

### Files and Folders

| Element | Convention | Example |
|---------|------------|---------|
| Folders | `kebab-case` | `user-profile/` |
| Component files | `PascalCase` | `UserCard.tsx` |
| Utility/hook files | `camelCase` | `useUser.ts` |
| Static assets | `kebab-case` or `snake_case` | `logo-dark.svg` |
| Context providers | `XyzProvider` | `ThemeProvider` |

### Code

| Element | Convention | Example |
|---------|------------|---------|
| Variables/Functions | `camelCase` | `getUserData` |
| Types/Interfaces | `PascalCase` | `UserProfile` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |

## Component Best Practices

**When to Create a Component:**
- If a UI pattern is reused more than once
- If a section of a page is complex or self-contained
- If it improves readability or testability

**Props:**
- Use TypeScript interfaces for props
- Prefer explicit prop types and default values

```typescript
interface UserCardProps {
  user: User;
  showAvatar?: boolean;
}

export function UserCard({ user, showAvatar = true }: UserCardProps) {
  // ...
}
```

**Component Location:**
- Place shared components in `components/`
- Place route-specific components inside the relevant route folder

**Testing:**
- Co-locate tests with components (e.g., `UserCard.test.tsx`)

## Tooling Updates (Next.js 16)

**Turbopack is the default dev bundler.** Configure via the top-level `turbopack` field in `next.config.*`:

```javascript
// next.config.mjs
export default {
  turbopack: {
    // turbopack options
  },
};
```

**Typed routes are stable** via `typedRoutes: true` (TypeScript required).

**ESLint**: In Next.js 16, prefer running ESLint via the ESLint CLI (not `next lint`).

**Environment Variables**: `serverRuntimeConfig` / `publicRuntimeConfig` are removed. Use environment variables directly. Note that `NEXT_PUBLIC_` variables are inlined at build time.

## Best Practices

1. **Server Components by default** — only add `'use client'` when you need hooks, event handlers, or browser APIs
2. **`import 'server-only'`** on any module that uses secrets — prevents accidental client bundling
3. **No `NEXT_PUBLIC_` for secrets** — only use the prefix for values safe to expose in the browser
4. **`force-dynamic` on DB pages** — prevents build-time prerendering that requires a live database
5. **Server Actions for mutations** — use `'use server'` functions instead of API routes for form submissions
6. **Parallel data fetching** — use `Promise.all()` in Server Components to fetch data concurrently
7. **Loading skeletons** — add `loading.tsx` per route for instant navigation feedback
8. **Error boundaries** — add `error.tsx` per route (must be `'use client'`)
9. **Virtual DOM** — Do not manipulate the real DOM. Use `useState` for state changes.
10. **TypeScript strict mode** — Enable `strict: true` in `tsconfig.json`
11. **Validate all input** — Use libraries like `zod` for API routes and Server Actions
12. **Use Suspense boundaries** — Isolate async data fetching for progressive loading
13. **Avoid large client bundles** — Keep most logic in Server Components
