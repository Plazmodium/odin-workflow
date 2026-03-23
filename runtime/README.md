# Odin Runtime

A single-install MCP server that gives your AI coding agent an 11-phase development workflow with built-in quality gates, skill resolution, review checks, learnings, and release archival.

## Quick Start

### 1. Install

```bash
cd system/mcp-servers/odin-runtime
npm install
npm run build
```

### 2. Bootstrap your project

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

Use the project root `.env` or `.env.local` file that lives next to `opencode.json` / `.mcp.json` / `.odin/`. Odin does not read env files from nested app directories.

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
| `odin.get_development_eval_status` | Inspect focused development-eval state for a feature |
| `odin.record_phase_artifact` | Register a phase output (PRD, spec, tasks, etc.) |
| `odin.submit_claim` | Submit a watched-agent claim for policy and watcher verification |
| `odin.record_commit` | Persist git commit metadata for a feature |
| `odin.record_pr` | Persist pull request metadata for dashboard/git tracking |
| `odin.record_merge` | Persist that a human merged the feature PR |
| `odin.record_quality_gate` | Persist an explicit workflow quality gate decision |
| `odin.record_eval_plan` | Persist a structured Architect `eval_plan` artifact |
| `odin.record_eval_run` | Persist a structured Reviewer/Integrator `eval_run` artifact |
| `odin.record_phase_result` | Record phase completion, blocking, or rework |
| `odin.run_review_checks` | Run security/review scans via Semgrep |
| `odin.run_policy_checks` | Run deterministic policy checks for submitted claims |
| `odin.verify_design` | Run formal design verification (TLA+ model checking) on a `.machine.ts` DSL file |
| `odin.capture_learning` | Capture a reusable learning with semantic domain matching |
| `odin.get_feature_status` | Inspect feature state with workflow details |
| `odin.verify_claims` | Check claim verification status |
| `odin.get_claims_needing_review` | List claims waiting for watcher review |
| `odin.record_watcher_review` | Record the watcher verdict for an escalated claim |
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
  provider: none           # set to "tla-precheck" after installing Java 17+ and `npm install -D tla-precheck`
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

## Optional: TLA+ Design Verification

`odin.verify_design` is optional and stays disabled while `formal_verification.provider` is `none`.

Install it in the **target project Odin runs against**, not in the runtime package:

```bash
# In your target project root
npm install -D tla-precheck
```

Requirements and setup:

- Install **Java 17+** locally for the TLC model checker
- Install `tla-precheck` as a dev dependency in the target project so Odin can resolve it from `node_modules/.bin`
- Enable it in `.odin/config.yaml`

```yaml
formal_verification:
  provider: tla-precheck
  timeout_seconds: 120
```

Typical usage:

1. Create a state-machine file such as `specs/BILLING-001/subscription.machine.ts`
2. Ask Odin to run `odin.verify_design` with that relative `machine_path`
3. Review the result in Architect/Guardian before implementation

If Java or `tla-precheck` is missing, Odin returns an `UNAVAILABLE` / `NOT_CONFIGURED` result for design verification instead of enabling it silently.

## Development Evals

Odin also supports a lightweight **Development Evals** workflow track:

- Architect records `eval_plan` via `odin.record_eval_plan` (or `odin.record_phase_artifact`)
- Guardian records `eval_readiness` via `odin.record_quality_gate`
- Reviewer records `eval_run` via `odin.record_eval_run` (or `odin.record_phase_artifact`)
- Integrator may append a later `eval_run` via `odin.record_eval_run` when runtime verification materially changes the result

These artifacts are surfaced in `odin.prepare_phase_context` and `odin.get_feature_status`.

When Development Evals are relevant, `odin.prepare_phase_context` returns a richer `development_evals` block with:

- `expected_artifacts` — which eval artifact(s) this phase is expected to produce now
- `expected_gate` — which eval gate this phase is expected to decide now
- `status_summary` — current eval state the harness should keep visible
- `harness_prompt_block` — phase-specific prompt lines the harness should append verbatim to the active agent prompt

Recommended harness behavior:

```text
1. Call odin.prepare_phase_context(...)
2. Build the agent prompt from:
   - context.agent.role_summary
   - context.agent.constraints
   - context.development_evals.harness_prompt_block
3. Keep context.development_evals.status_summary visible to the operator
4. Do not treat eval instructions as a replacement for formal verification, Semgrep, tests, runtime checks, or watcher checks
```

Canonical eval-aware orchestration snippet:

```text
When orchestrating Odin phases:
1. Call odin.prepare_phase_context({ feature_id, phase, agent_name }).
2. Build the active agent prompt from:
   - context.agent.role_summary
   - context.agent.constraints
   - context.development_evals.harness_prompt_block
3. Use odin.get_development_eval_status({ feature_id }) when you need focused eval state.
4. Record eval artifacts/gates with odin.record_eval_plan, odin.record_eval_run, and odin.record_quality_gate.
5. Never let Development Evals override odin.verify_design, odin.run_review_checks, tests, runtime verification, or watcher checks.
```

If the harness wants a focused eval-only read path instead of parsing `odin.get_feature_status`, call:

```text
odin.get_development_eval_status({ feature_id: "FEAT-001" })
```

This returns the current Development Eval mode, latest `eval_plan`, latest `eval_run`, open `eval_readiness` gate (if any), and recent eval artifact history.

**Important**: Development Evals are additive. They do **not** replace `odin.verify_design`, `odin.run_review_checks`, Builder/Integrator test verification, or watched-claim verification.

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
