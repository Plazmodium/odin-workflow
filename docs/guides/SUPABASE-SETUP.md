# Supabase Setup Guide for Odin

This guide walks you through setting up Supabase as the backend for the Odin's workflow state management, memory persistence, and file archival.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create Supabase Project](#1-create-supabase-project)
3. [Run Database Migrations](#2-run-database-migrations)
4. [Create Storage Bucket](#3-create-storage-bucket)
5. [Deploy Edge Functions](#4-deploy-edge-functions)
6. [Configure MCP Server](#5-configure-mcp-server)
7. [Verify Setup](#6-verify-setup)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- [Supabase account](https://supabase.com) (free tier works)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local development)
- Odin (the orchestrator) or another MCP-compatible client

---

## 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click **New Project**
3. Fill in:
   - **Name**: `sdd-framework` (or your preference)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to you
4. Click **Create new project**
5. Wait for project to initialize (~2 minutes)

### Save Your Credentials

After creation, save these values (Settings → API):

| Credential | Where to Find | Used For |
|------------|---------------|----------|
| Project URL | Settings → API | MCP config, Edge Functions |
| Publishable Key | Settings → API → Publishable keys | Client-side auth, Edge Function calls |
| Secret Key | Settings → API → Secret keys | Dashboard server-side access (keep secret!) |

> **Note**: Supabase previously called the Secret Key the "Service Role Key". If you see references to `SUPABASE_SERVICE_ROLE_KEY` in older documentation, it refers to the same key now found under "Secret keys".

---

## 2. Run Database Migrations

Odin uses 4 consolidated migration files (replacing the original 28 development migrations).

### Migration Files

| File | Purpose | Objects |
|------|---------|---------|
| `001_schema.sql` | Core schema | 23 tables, 16 enums, 60+ indexes, RLS policies |
| `002_functions.sql` | Business logic | 30+ functions (workflow, git, learnings, evals) |
| `003_views.sql` | Dashboard views | 12 views (features, learnings, evals, batch) |
| `004_seed.sql` | Initial data | 5 batch templates |

### Option A: Via Supabase Dashboard (Recommended)

1. Go to **SQL Editor** in Supabase Dashboard
2. Run each migration file in order from `migrations/`
3. Run migrations 001 through 004 sequentially

### Option B: Via Supabase MCP (If Already Configured)

If you have Supabase MCP configured, you can apply migrations:

```
Apply migration 001_create_enums using Supabase MCP
```

### Verify Tables Created

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected tables (23):**
- Core: `features`, `phase_transitions`, `quality_gates`, `blockers`, `agent_invocations`
- Git: `feature_commits`
- Phase outputs: `phase_outputs`
- Learnings: `learnings`, `learning_conflicts`, `learning_propagation_targets`, `learning_propagations`
- EVALS: `feature_evals`, `system_health_evals`, `eval_alerts`
- Batch: `batch_executions`, `batch_templates`
- Misc: `feature_archives`, `audit_log`, plus others

**Expected views (12):**
- Features: `active_features`, `feature_health_overview`
- Learnings: `active_learnings`, `propagation_queue`, `open_learning_conflicts`, `skill_propagation_queue`
- EVALS: `active_eval_alerts`, `latest_system_health`
- Batch: `batch_template_list`

---

## 3. Create Storage Bucket

The archive system stores completed feature files in Supabase Storage.

### Via Supabase Dashboard

1. Go to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Configure:
   - **Name**: `workflow-archives`
   - **Public bucket**: Yes (dashboard handles auth at app level)
   - **File size limit**: 50MB (optional)
4. Click **Create Bucket**

### Via SQL (Alternative)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('workflow-archives', 'workflow-archives', true);
```

### Verify Bucket

```sql
SELECT id, name, public FROM storage.buckets
WHERE id = 'workflow-archives';
```

---

## 4. Deploy Edge Functions

The Odin requires Edge Functions for operations not available via MCP.

### Required Edge Functions

| Function | Purpose | Deployed By |
|----------|---------|-------------|
| `archive-upload` | Batch upload files to Storage | Auto or Manual |

### Option A: Auto-Deploy via Orchestrator (Recommended)

The orchestrator can deploy Edge Functions automatically. In your AI coding assistant:

```
Deploy the archive-upload Edge Function to Supabase
```

The orchestrator will use `mcp__supabase__deploy_edge_function` with this code:

> **Note**: Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` as an auto-injected environment variable by Supabase's runtime. This is NOT the same as the user-configured env var — Supabase sets it automatically.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { feature_id, files } = await req.json();

    if (!feature_id || !files?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'feature_id and files required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const filesUploaded = [];
    let totalSizeBytes = 0;

    for (const file of files) {
      const filePath = `${feature_id}/${file.name}`;
      const contentBytes = new TextEncoder().encode(file.content);
      totalSizeBytes += contentBytes.length;

      const { error } = await supabase.storage
        .from('workflow-archives')
        .upload(filePath, contentBytes, { contentType: 'text/markdown', upsert: true });

      if (!error) filesUploaded.push(file.name);
    }

    return new Response(
      JSON.stringify({
        success: filesUploaded.length > 0,
        storage_path: `workflow-archives/${feature_id}/`,
        files_uploaded: filesUploaded,
        total_size_bytes: totalSizeBytes,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Option B: Manual Deploy via Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref [your-project-ref]

# Create function directory
mkdir -p supabase/functions/archive-upload

# Create index.ts with code above
# Then deploy
supabase functions deploy archive-upload
```

### Verify Edge Function

```bash
curl -X POST \
  'https://[your-project-ref].supabase.co/functions/v1/archive-upload' \
  -H 'Authorization: Bearer [your-anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{"feature_id": "TEST-001", "files": [{"name": "test.md", "content": "# Test"}]}'
```

Expected response:
```json
{
  "success": true,
  "storage_path": "workflow-archives/TEST-001/",
  "files_uploaded": ["test.md"],
  "total_size_bytes": 7
}
```

---

## 5. Configure MCP Server

Add Supabase MCP to your Odin configuration. Odin requires MCP access for the orchestrator to manage workflow state.

### Create MCP Config

Create `~/.config/odin/mcp.json` (global) or `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=[your-project-ref]"
    }
  }
}
```

**Get your project ref**: Supabase Dashboard → **Settings** → **General** → **Reference ID**

### Restart Odin

After creating the config, restart Odin to load the MCP server.

### Important: Agent MCP Limitations

Task-spawned agents (Discovery, Architect, Builder, etc.) **do not have MCP access**. Only Odin (the orchestrator) can use MCP tools.

This is why Odin uses **Hybrid Orchestration**:
- Agents document what needs to happen (in markdown artifacts)
- Odin (orchestrator) executes MCP operations based on agent outputs

See [HYBRID-ORCHESTRATION-PATTERN.md](../reference/HYBRID-ORCHESTRATION-PATTERN.md) for details on this architectural pattern.

---

## 6. Verify Setup

### Complete Verification Checklist

Run these SQL queries in Supabase SQL Editor to verify your setup:

```sql
-- 1. Check tables (expect 23)
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 23

-- 2. Check views (expect 12)
SELECT COUNT(*) as view_count
FROM information_schema.views
WHERE table_schema = 'public';
-- Expected: 12

-- 3. Check functions (expect 30+)
SELECT COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
-- Expected: 30+

-- 4. Check batch_templates seeded (expect 5 rows)
SELECT COUNT(*) as template_count FROM batch_templates;
-- Expected: 5

-- 5. Check storage bucket exists
SELECT id, name, public FROM storage.buckets
WHERE id = 'workflow-archives';
-- Expected: 1 row with public = true
```

### Test Core Workflow Functions

```sql
-- Create a test feature
SELECT * FROM create_feature(
  'TEST-001',
  'Setup Test Feature',
  1,
  'ROUTINE',
  NULL, NULL,
  'setup-test',
  NULL, 'main', 'Tester'
);
-- Expected: Returns feature with branch_name = 'feature/TEST-001'

-- Transition phase
SELECT * FROM transition_phase('TEST-001', '1'::phase, 'setup-test', 'Testing setup');
-- Expected: Returns transition record

-- Get feature status
SELECT * FROM get_feature_status('TEST-001');
-- Expected: Returns feature with current_phase = '1'

-- Clean up test feature
DELETE FROM features WHERE id = 'TEST-001';
```

### Test Dashboard Connection

1. Start dashboard: `cd dashboard && npm run dev`
2. Open http://localhost:3000
3. Verify Health Overview loads (may show "No features found" if empty)
4. Create a test feature via SQL and verify it appears

### Test Archive Upload (Optional)

```bash
# Upload test file
curl -X POST \
  'https://[project-ref].supabase.co/functions/v1/archive-upload' \
  -H 'Authorization: Bearer [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{"feature_id": "SETUP-TEST", "files": [{"name": "verify.md", "content": "Setup verified"}]}'

# Clean up via SQL
DELETE FROM storage.objects
WHERE bucket_id = 'workflow-archives' AND name LIKE 'SETUP-TEST/%';
```

### Quick Verification Summary

| Check | Expected | Pass? |
|-------|----------|-------|
| Tables exist | 23 | ☐ |
| Views exist | 12 | ☐ |
| Functions exist | 30+ | ☐ |
| batch_templates seeded | 5 rows | ☐ |
| workflow-archives bucket | exists, public | ☐ |
| create_feature() works | returns feature | ☐ |
| transition_phase() works | returns transition | ☐ |
| Dashboard loads | shows UI | ☐ |

---

## What's Included After Setup

### Database Schema

| Component | Count | Purpose |
|-----------|-------|---------|
| Tables | 23 | Workflow state, learnings, evals, git |
| Views | 12 | Dashboard queries, propagation queues |
| Functions | 30+ | Workflow, invocations, git, learnings, evals |
| Enums | 16 | Type safety |

### Key Tables

| Table | Purpose |
|-------|---------|
| `features` | Feature tracking and status |
| `phase_transitions` | Workflow phase history |
| `learnings` | Evolving knowledge base |
| `feature_archives` | Archived feature metadata |
| `agent_invocations` | Agent duration tracking |
| `blockers` | Issues blocking progress |
| `feature_commits` | Git commits per feature |
| `feature_evals` | Performance snapshots |

### Storage

| Bucket | Purpose |
|--------|---------|
| `workflow-archives` | Archived feature files |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `archive-upload` | Batch file upload to Storage |

---

## Troubleshooting

### "Table does not exist" errors

**Cause**: Migrations not applied in order.
**Fix**: Run migrations 001 → 004 sequentially.

### "Storage bucket not found"

**Cause**: `workflow-archives` bucket not created.
**Fix**: Create bucket via Dashboard → Storage → New Bucket.

### "Edge Function returns 401"

**Cause**: Missing Authorization header.
**Fix**: Include `Authorization: Bearer [anon-key]` in requests.

### "MCP server not responding"

**Cause**: MCP config incorrect.
**Fix**:
1. Verify `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)
2. Restart your AI coding assistant
3. Check MCP server logs

### "Permission denied on storage"

**Cause**: Bucket is private or RLS blocking.
**Fix**: Ensure bucket is public, or add storage policies.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   PostgreSQL    │  │     Storage     │  │ Edge Functions  │ │
│  │                 │  │                 │  │                 │ │
│  │ • features      │  │ workflow-       │  │ archive-upload  │ │
│  │ • memories      │  │ archives/       │  │                 │ │
│  │ • archives      │  │                 │  │                 │ │
│  │ • invocations   │  │ • AUTH-001/     │  │                 │ │
│  │ • blockers      │  │ • USER-042/     │  │                 │ │
│  │ • views         │  │ • ...           │  │                 │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ODIN (ORCHESTRATOR)                           │
│                                                                 │
│  Uses Supabase MCP to:          Calls Edge Function to:        │
│  • Track feature state          • Upload archived files        │
│  • Store memories               • Batch file operations        │
│  • Query archives                                               │
│  • Track agent durations                                        │
│                                                                 │
│  Odin connects directly to MCP servers and spawns agents       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [ODIN.md](../../ODIN.md) | Framework overview |
| [multi-agent-protocol.md](../framework/multi-agent-protocol.md) | Multi-agent workflow |
| [SKILLS-SYSTEM.md](../reference/SKILLS-SYSTEM.md) | Composable skills |
| [ORCHESTRATOR-MEMORY-PATTERN.md](../reference/ORCHESTRATOR-MEMORY-PATTERN.md) | Memory persistence |
| [SEQUENTIAL-THINKING-USAGE.md](../reference/SEQUENTIAL-THINKING-USAGE.md) | Complex reasoning |
| [migrations/README.md](../../migrations/README.md) | Migration details |

---

## Next Steps After Setup

1. **Test the workflow** - Run a feature through Discovery → Release
2. **Configure agents** - Review `agents/definitions/` configurations
3. **Add skills** - Set up domain-specific skills in `agents/skills/`
4. **Build dashboard** - Connect to Supabase for real-time monitoring

---

**Version**: 2.2
**Last Updated**: 2026-02-16
**Status**: Complete
