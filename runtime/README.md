# Odin Runtime

A single-install MCP server that gives your AI coding agent an 11-phase development workflow with built-in quality gates, skill resolution, review checks, learnings, and release archival.

## Quick Start

### 1. Install

```bash
cd runtime
npm install
npm run build
```

### 2. Bootstrap your project

Run these commands from `odin-workflow/runtime`. The `init:project` script is defined in this package, not in your target project.

```bash
# For Amp
npm run init:project -- --project-root /path/to/your/project --tool amp --write-mcp

# For Claude Code
npm run init:project -- --project-root /path/to/your/project --tool claude-code --write-mcp

# For OpenCode
npm run init:project -- --project-root /path/to/your/project --tool opencode --write-mcp

# For Codex
npm run init:project -- --project-root /path/to/your/project --tool codex --write-mcp
```

If you want to run the bootstrap from inside your target project directory, call the built init CLI directly instead of `npm run`:

```bash
cd /path/to/your/project
node /absolute/path/to/odin-workflow/runtime/dist/init.js --tool amp --write-mcp
```

This creates:
- `.odin/config.yaml` — runtime configuration (commit this)
- `.odin/skills/` — project-local skill overrides (commit this)
- `.env.example` — required environment variables (commit this)
- Your harness config file (`opencode.json`, `.mcp.json`, or `.codex/config.toml`, depending on tool)

Important: Odin bootstraps with `runtime.mode: supabase` by default. Before your harness can load the Odin MCP server, your project root must have a `.env` or `.env.local` file with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or those values must be set directly in `.odin/config.yaml`). If those values are missing, the Odin server exits at startup and your harness will show the MCP as failed/closed. If you are only testing MCP wiring first, change `.odin/config.yaml` to `runtime.mode: in_memory`.

### 3. Add your database credentials

```bash
cp .env.example .env
# Edit .env with your database credentials
```

Use the project root `.env` or `.env.local` file that lives next to your MCP config and `.odin/`. Odin does not read env files from nested app directories.

Odin supports two database connection methods:

- **Direct PostgreSQL** (any provider — Neon, Railway, self-hosted, Supabase, etc.):
  ```env
  DATABASE_URL=postgresql://user:password@host:5432/dbname
  ```

- **Supabase Management API** (Supabase-specific):
  ```env
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SECRET_KEY=your-secret-key
  SUPABASE_ACCESS_TOKEN=your-management-api-access-token
  ```

`DATABASE_URL` takes priority if both are set.

### 4. Start using Odin

Your AI agent now has these tools available:

| Tool | Purpose |
|------|---------|
| `odin.start_feature` | Create a feature in the workflow |
| `odin.get_next_phase` | Ask "what should happen next?" |
| `odin.prepare_phase_context` | Get the full working bundle for a phase |
| `odin.record_phase_artifact` | Register a phase output (PRD, spec, tasks, etc.) |
| `odin.record_phase_result` | Record phase completion, blocking, or rework |
| `odin.run_review_checks` | Run security/review scans via Semgrep |
| `odin.verify_design` | Run formal design verification (TLA+ model checking) on a `.machine.ts` DSL file |
| `odin.capture_learning` | Capture a reusable learning with semantic domain matching |
| `odin.get_feature_status` | Inspect feature state with workflow details |
| `odin.verify_claims` | Check claim verification status |
| `odin.archive_feature_release` | Archive release artifacts to Supabase Storage |
| `odin.explore_knowledge` | Explore knowledge clusters, cross-domain bridges, and domain stats |
| `odin.apply_migrations` | Apply pending database migrations (auto-detects existing schema) |

## Configuration

Odin uses two files:

**`.odin/config.yaml`** (committed) — project-level config with env var interpolation:

```yaml
runtime:
  mode: supabase        # or "in_memory" for local-only use

database:
  url: ${DATABASE_URL}  # direct PostgreSQL (any provider)

supabase:
  url: ${SUPABASE_URL}
  secret_key: ${SUPABASE_SECRET_KEY}

skills:
  paths:
    - .odin/skills
  auto_detect: true

review:
  provider: semgrep

formal_verification:
  provider: none           # set to "tla-precheck" to enable
  timeout_seconds: 120

archive:
  provider: supabase
```

**`.env`** (uncommitted) — secret values:

```env
# Option A: Direct PostgreSQL (works with any provider)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option B: Supabase Management API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_ACCESS_TOKEN=your-management-api-access-token
```

### Runtime Modes

- **`supabase`** (recommended) — Full workflow state backed by Supabase. Requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The runtime will fail fast with a clear error if credentials are missing. Provides all features including release archival via Supabase Storage.
- **`in_memory`** — Local-only scaffold mode. No external dependencies. State is lost when the process exits. Useful for testing the runtime surface without a Supabase project.

> **Note on `DATABASE_URL`**: Using direct PostgreSQL (Neon, Railway, etc.) provides full workflow state and migrations, but **release archival** (`odin.archive_feature_release`) requires Supabase Storage. If you use `DATABASE_URL` without Supabase credentials, the archive tool will return an error. All other tools work normally.

## Project-Local Skills

Drop skill files into `.odin/skills/` to override or extend built-in skills:

```text
.odin/skills/
  my-framework/
    SKILL.md
```

Odin resolves project-local skills with higher precedence than built-in skills when names match.

## Memory Palace: Semantic Learning Propagation

Odin's learning system uses **semantic domain matching** to automatically route learnings to the right knowledge targets (skills, agent definitions, AGENTS.md).

### How it works

1. **Capture with tags**: When calling `odin.capture_learning`, agents provide `domain_tags` — conceptual keywords describing what the learning is about (e.g., `["nextjs", "fetch-cache", "supabase"]`)
2. **Domain matching**: The runtime matches tags against a **knowledge domain registry** derived from skill frontmatter. Each skill's `name`, `compatible_with`, `depends_on`, `category`, and `description` generate keyword tiers (strong + weak)
3. **Auto-targeting**: Matches passing both gates (≥ 1 strong keyword hit AND ≥ 0.60 relevance) are auto-declared as propagation targets. Weaker matches are returned as suggestions
4. **Cross-feature corridors**: `odin.prepare_phase_context` retrieves related learnings from other features that share propagation targets, with tag intersection fallback
5. **Resonance ranking**: Related learnings are ranked by domain density, corroboration (same-category learnings from different features), and recency — never modifying `confidence_score`

### Exploration

Use `odin.explore_knowledge` to inspect knowledge clusters:
- Learnings grouped by domain
- Cross-domain bridges (learnings appearing in multiple domains)
- Domain density stats
- Unmatched tags (tags that matched zero domains)

### Adding a domain

Adding a new skill with proper frontmatter (`name`, `description`, `category`, `compatible_with`, `depends_on`) **automatically creates a new knowledge domain** — zero configuration, zero migration.

## Development

```bash
npm run type-check    # Check types without emitting
npm run build         # Compile TypeScript to dist/
npm test              # Run tests
npm start             # Start the MCP server (stdio)
npm run dev           # Watch mode
```

## Architecture

Odin presents **one MCP server** (`odin`) to your AI agent. Internally it uses adapter seams for different concerns:

- **WorkflowStateAdapter** — Supabase-backed feature/phase state
- **SqlExecutor** — Provider-agnostic SQL execution (direct PostgreSQL or Supabase Management API)
- **ArchiveAdapter** — Supabase Storage for release archives (direct upload, no Edge Function needed)
- **ReviewAdapter** — Semgrep for security/code review
- **FormalVerificationAdapter** — TLA+ model checking via [tla-precheck](https://github.com/kingbootoshi/tla-precheck) (opt-in)
- **SkillAdapter** — Filesystem-based skill resolution (built-in + project-local)

Providers are internal implementation details — your agent only sees `odin.*` tools.

## Requirements

- Node.js >= 18
- PostgreSQL database — any provider: Supabase, Neon, Railway, self-hosted, etc. (for `supabase` runtime mode)
- Semgrep (optional, for review checks — falls back to Docker if local binary not found)
- Java 17+ and [tla-precheck](https://github.com/kingbootoshi/tla-precheck) (optional, for formal design verification — install as a devDependency in your target project)
