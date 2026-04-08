# Supabase Setup For Odin

Use this guide when configuring Supabase for Odin's persistent workflow state, archives, dashboard, and skill-proposal pipeline.

---

## 1. Prerequisites

- Supabase project created
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_ACCESS_TOKEN` for `odin.apply_migrations` when using the Supabase Management API path

> Supabase previously called the Secret Key the "Service Role Key". Older references to `SUPABASE_SERVICE_ROLE_KEY` mean the current Secret Key.

---

## 2. Run Database Migrations

For a fresh install, run the **full current migration set** from `migrations/`.

Canonical order:

```sql
\i 001_schema.sql
\i 002_functions.sql
\i 003_views.sql
\i 004_seed.sql
\i 005_odin_v2_schema.sql
\i 006_odin_v2_functions.sql
\i 007_odin_v2_phase_alignment.sql
\i 008_related_learnings.sql
\i 009_skill_proposal_candidates.sql
\i 010_skill_proposals.sql
\i 011_complete_feature_phase_coverage.sql
```

See `migrations/README.md` for the current authoritative migration inventory.

If using Supabase MCP, use the filename without `.sql` as the migration name (for example `001_schema`, `010_skill_proposals`).

---

## 3. Configure Archive Storage

Odin's archive adapter uploads directly to Supabase Storage. **No Edge Function is required.**

Create a private bucket named `feature-archives`.

### Via SQL

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('feature-archives', 'feature-archives', false)
ON CONFLICT (id) DO NOTHING;
```

### Verify Bucket

```sql
SELECT id, name, public
FROM storage.buckets
WHERE id = 'feature-archives';
```

Expected: one row with `public = false`.

---

## 4. Verify Setup

### Quick SQL Checks

```sql
-- 1. Check tables (expect 29+)
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Check views (expect 24)
SELECT COUNT(*) AS view_count
FROM information_schema.views
WHERE table_schema = 'public';

-- 3. Check functions (expect 30+)
SELECT COUNT(*) AS function_count
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- 4. Check batch_templates seeded (expect 5 rows)
SELECT COUNT(*) AS template_count FROM batch_templates;

-- 5. Check storage bucket exists
SELECT id, name, public FROM storage.buckets
WHERE id = 'feature-archives';
```

### Dashboard Check

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:3000` and verify the dashboard loads.

---

## 5. What's Included After Setup

- Persistent workflow state in Supabase
- Learnings, propagation targets, related learnings, and governed skill proposal workflow
- Dashboard read models and 11-phase visibility
- Private archive storage in `feature-archives`
- No Edge Function dependency for release archives

---

## Troubleshooting

### "Table does not exist"

- Cause: migrations not fully applied
- Fix: rerun the full current migration set (`001` -> `011`) in order

### "Storage bucket not found"

- Cause: `feature-archives` bucket missing
- Fix: create the private `feature-archives` bucket

### "Permission denied on storage"

- Cause: wrong key or bucket policy mismatch
- Fix: use `SUPABASE_SECRET_KEY`; keep the bucket private; let Odin's server-side adapter access it

### `odin.apply_migrations` fails with URL / project-ref errors

- Cause: malformed `SUPABASE_URL` or unsupported local endpoint
- Fix: use the project base URL (`https://<ref>.supabase.co`) or use `DATABASE_URL` for direct PostgreSQL migrations

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [ODIN.md](../../ODIN.md) | Framework overview |
| [docs/framework/multi-agent-protocol.md](../framework/multi-agent-protocol.md) | Legacy protocol history + current orchestration notes |
| [docs/reference/SKILLS-SYSTEM.md](../reference/SKILLS-SYSTEM.md) | Composable skills |
| [migrations/README.md](../../migrations/README.md) | Migration details |
| [runtime/README.md](../../runtime/README.md) | Runtime setup and adapter behavior |
