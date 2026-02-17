/**
 * Odin Dashboard - Supabase Server Client
 * 
 * This module is server-only. It MUST NOT be imported in Client Components.
 * The secret key bypasses RLS and must never be exposed to the browser.
 */
import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createServerClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local\n' +
      '(Find your secret key in: Supabase Dashboard → Settings → API → Secret keys)'
    );
  }

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Bypass Next.js fetch cache — ensures every query hits Supabase directly.
      // Without this, Next.js 14 patches global fetch with cache: 'force-cache',
      // causing stale data even with force-dynamic on pages.
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  });

  return client;
}
