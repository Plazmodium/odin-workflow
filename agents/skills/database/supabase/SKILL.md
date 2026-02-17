---
name: supabase
description: Supabase expertise for PostgreSQL database, authentication, storage, real-time subscriptions, and edge functions
category: database
version: "2.x"
depends_on:
  - postgresql
compatible_with:
  - nextjs-dev
  - nodejs-express
  - prisma-orm
---

# Supabase Development

## Overview

Supabase is an open-source Firebase alternative providing PostgreSQL database, authentication, instant APIs, real-time subscriptions, storage, and edge functions.

## Client Setup

### JavaScript/TypeScript

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// For server-side with secret key (admin access, bypasses RLS)
// Find in: Supabase Dashboard → Settings → API → Secret keys
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: { persistSession: false },
    global: {
      // CRITICAL for Next.js 14: Bypass fetch cache to prevent stale data.
      // Next.js patches global fetch with cache: 'force-cache' by default.
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  }
);
```

### Generate Types

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
```

## Database Queries

### Basic CRUD

```typescript
// Select
const { data, error } = await supabase
  .from('users')
  .select('id, email, name')
  .eq('is_archived', false);

// Select with relations
const { data, error } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    content,
    author:users(id, name, email)
  `)
  .eq('published', true);

// Insert
const { data, error } = await supabase
  .from('users')
  .insert({ email: 'user@example.com', name: 'John' })
  .select()
  .single();

// Update
const { data, error } = await supabase
  .from('users')
  .update({ name: 'Jane' })
  .eq('id', userId)
  .select()
  .single();

// Archive (not delete!)
const { error } = await supabase
  .from('users')
  .update({ is_archived: true, archived_at: new Date().toISOString() })
  .eq('id', userId);

// Actual delete (use sparingly)
const { error } = await supabase
  .from('users')
  .delete()
  .eq('id', userId);
```

### Filtering

```typescript
// Multiple conditions
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('published', true)
  .eq('is_archived', false)
  .gte('created_at', '2024-01-01')
  .order('created_at', { ascending: false })
  .limit(10);

// OR conditions
const { data } = await supabase
  .from('users')
  .select('*')
  .or('role.eq.admin,role.eq.moderator');

// Text search
const { data } = await supabase
  .from('posts')
  .select('*')
  .textSearch('title', 'search query');

// In array
const { data } = await supabase
  .from('users')
  .select('*')
  .in('id', [id1, id2, id3]);
```

### Pagination

```typescript
const page = 1;
const pageSize = 20;

const { data, count } = await supabase
  .from('posts')
  .select('*', { count: 'exact' })
  .eq('is_archived', false)
  .range((page - 1) * pageSize, page * pageSize - 1)
  .order('created_at', { ascending: false });

const totalPages = Math.ceil((count || 0) / pageSize);
```

## Authentication

### Sign Up / Sign In

```typescript
// Sign up with email
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
  options: {
    data: { name: 'John Doe' }, // Custom user metadata
  },
});

// Sign in with email
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword',
});

// Sign in with OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${origin}/auth/callback` },
});

// Sign out
await supabase.auth.signOut();
```

### Session Management

```typescript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Handle sign in
  } else if (event === 'SIGNED_OUT') {
    // Handle sign out
  }
});
```

### Password Reset

```typescript
// Send reset email
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${origin}/auth/reset-password`,
});

// Update password (after redirect)
const { error } = await supabase.auth.updateUser({
  password: newPassword,
});
```

## Row Level Security (RLS)

### Enable RLS

```sql
-- Always enable RLS on tables with user data
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read published posts
CREATE POLICY "Public posts are viewable by everyone"
ON posts FOR SELECT
USING (published = true AND is_archived = false);

-- Policy: Users can only edit their own posts
CREATE POLICY "Users can edit own posts"
ON posts FOR UPDATE
USING (auth.uid() = author_id);

-- Policy: Users can only insert as themselves
CREATE POLICY "Users can create own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = author_id);
```

### Common RLS Patterns

```sql
-- Authenticated users only
CREATE POLICY "Authenticated access"
ON table_name FOR ALL
USING (auth.role() = 'authenticated');

-- Owner access
CREATE POLICY "Owner access"
ON table_name FOR ALL
USING (auth.uid() = user_id);

-- Role-based access
CREATE POLICY "Admin access"
ON table_name FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
```

## Real-time Subscriptions

### Prerequisites (CRITICAL)

Supabase Realtime requires **three layers** of configuration:

1. **Database layer** — Add tables to the `supabase_realtime` publication:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
   ```

2. **RLS layer** — The subscribing role (usually `anon`) needs SELECT policies:
   ```sql
   CREATE POLICY "Anon read access" ON your_table
     FOR SELECT TO anon USING (true);
   ```

3. **Infrastructure layer** — The Realtime service must recognize your project as a "tenant". This is configured through the **Supabase Dashboard → Database → Replication**, NOT via SQL.

> **GOTCHA: TenantNotFound Error**
>
> If you only configure layers 1 and 2 via SQL but skip layer 3 (Dashboard), WebSocket connections will fail with `TenantNotFound: Tenant not found: <project-ref>`. The database side looks correct (publication exists, RLS policies in place, `wal_level = logical`), but the Realtime Elixir service doesn't have your project registered.
>
> **Diagnosis**: Check Supabase Realtime logs for `error_code: "TenantNotFound"`. You may also see Cloudflare Error 1101 ("Worker threw exception") when hitting the `/realtime/v1/` endpoint.
>
> **As of 2026-02**: Database → Replication is in **alpha** and requires paid onboarding on some plans. If you can't enable it, use **polling** instead (see Next.js skill for the pattern).

### Subscription Code (when Realtime IS available)

```typescript
// Subscribe to changes
const channel = supabase
  .channel('posts-changes')
  .on(
    'postgres_changes',
    {
      event: '*', // INSERT, UPDATE, DELETE, or *
      schema: 'public',
      table: 'posts',
      filter: 'author_id=eq.' + userId,
    },
    (payload) => {
      console.log('Change:', payload);
    }
  )
  .subscribe();

// Cleanup
channel.unsubscribe();
```

### Verification Checklist

Before debugging Realtime issues, verify ALL three layers:

```sql
-- 1. Check publication has your tables
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 2. Check anon SELECT policies exist
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND roles::text LIKE '%anon%' AND cmd = 'SELECT';

-- 3. Check wal_level (must be 'logical')
SHOW wal_level;
```

Then check the **Supabase Dashboard → Database → Replication** to confirm the Realtime service is enabled for your project. If all three SQL checks pass but WebSocket still fails, the issue is layer 3.

## Storage

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/avatar.png`, file, {
    cacheControl: '3600',
    upsert: true,
  });

// Get public URL
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${userId}/avatar.png`);

// Download file
const { data, error } = await supabase.storage
  .from('documents')
  .download('path/to/file.pdf');

// Delete file
const { error } = await supabase.storage
  .from('avatars')
  .remove([`${userId}/avatar.png`]);
```

## Edge Functions

```typescript
// Invoke edge function
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' },
});
```

## Best Practices

1. **Always enable RLS** - Never expose tables without row-level security
2. **Use secret key server-side only** - Never expose the Supabase secret key to client
3. **Generate types** - Use `supabase gen types` for type safety
4. **Archive, don't delete** - Use `is_archived` pattern for recoverable data
5. **Filter archived records** - Always add `.eq('is_archived', false)` to queries
6. **Handle errors** - Always check for `error` in responses
7. **Use transactions** - Use `rpc` for complex multi-table operations

## Gotchas & Pitfalls

- **RLS blocks service role by default** - Use `SECURITY DEFINER` functions or check policies
- **Real-time has 3 config layers** - SQL publication + RLS policies + Dashboard Replication toggle. Missing any one causes silent failures
- **Real-time TenantNotFound** - If WebSocket fails with this error, the Dashboard Replication feature isn't enabled. SQL-only setup is NOT sufficient
- **Real-time requires paid onboarding** - As of 2026-02, Database → Replication is in alpha on some plans. Use polling as fallback
- **Key naming changed** - "Service Role Key" is now "Secret key", "Anon Key" is now "Publishable key" in the Dashboard
- **Next.js 14 caches Supabase responses** - The Supabase JS client uses `fetch` internally, and Next.js 14 patches `fetch` with `cache: 'force-cache'` by default. This causes stale data even with `force-dynamic` on pages. **Fix**: Pass `global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) }` in the client constructor. See frontend/nextjs-dev skill for full details.
- **Storage policies separate** - Storage has its own policy system
- **Type generation** - Re-run after schema changes
- **Connection limits** - Use connection pooling for serverless
- **Null handling** - PostgreSQL nulls require explicit handling

## Integration with Next.js

```typescript
// app/api/posts/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('is_archived', false);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
```
