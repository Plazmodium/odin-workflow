# Odin Runtime

A single-install MCP server that gives your AI coding agent an 11-phase development workflow with built-in quality gates, skill resolution, review checks, learnings, and release archival.

## Quick Start

### 1. Install

Preferred published-package flow:

```bash
npx -y @plazmodium/odin init --project-root /path/to/your/project --tool opencode --write-mcp
```

Maintainer repo-checkout flow:

```bash
cd runtime
npm install
npm run build
```

### 2. Bootstrap your project

```bash
# Published-package MCP command snippets
npx -y @plazmodium/odin init --project-root /path/to/your/project --tool amp --write-mcp
npx -y @plazmodium/odin init --project-root /path/to/your/project --tool opencode --write-mcp

# Source-checkout snippets while working on Odin from this repo
npm run init:project -- --project-root /path/to/your/project --tool amp --distribution source --write-mcp
npm run init:project -- --project-root /path/to/your/project --tool codex --distribution source --write-mcp
```

This creates:
- `.odin/config.yaml` — runtime configuration (commit this)
- `.odin/ODIN.md` — bundled Odin framework guide for the harness to read locally
- `.odin/agents/definitions/` — bundled phase agent definitions and shared context
- `.odin/skills/` — project-local skill overrides (commit this)
- `.env.example` — required environment variables (commit this)
- Your harness config file (`opencode.json`, `.mcp.json`, or `.codex/config.toml`, depending on tool)

Important: Odin bootstraps with `runtime.mode: in_memory` by default so MCP wiring can work without external services. Switch `.odin/config.yaml` to `runtime.mode: supabase` when you are ready for persistent workflow state.

If you are developing Odin from this repo, use the repo-checkout `--distribution source` flow shown above.

If you are the maintainer preparing that publish, use [the npm publish guide](https://github.com/Plazmodium/odin-workflow/blob/dev/docs/guides/NPM-PUBLISH.md).

### Manual MCP wiring

If you do not want Odin to write your harness config for you, add the MCP server manually.

For Claude Code / Amp:

```json
{
  "mcpServers": {
    "odin": {
      "command": "npx",
      "args": ["-y", "@plazmodium/odin", "mcp"],
      "env": {
        "ODIN_PROJECT_ROOT": "/absolute/path/to/your/project"
      }
    }
  }
}
```

For OpenCode:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "odin": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "@plazmodium/odin",
        "mcp"
      ],
      "enabled": true,
      "environment": {
        "ODIN_PROJECT_ROOT": "/absolute/path/to/your/project"
      }
    }
  }
}
```

For Codex:

```toml
[mcp_servers.odin]
command = "npx"
args = ["-y", "@plazmodium/odin", "mcp"]
env = { ODIN_PROJECT_ROOT = "/absolute/path/to/your/project" }
```

For Cursor, use the same command, args, and env values in the MCP Servers settings UI.

### 3. Add your database credentials

```bash
cp .env.example .env
# Edit .env with your database credentials
```

Use the project root `.env` or `.env.local` file that lives next to `opencode.json` / `.mcp.json` / `.odin/`. Odin does not read env files from nested app directories.

Runtime config is loaded once at server startup. If you change `.env`, `.env.local`, or `.odin/config.yaml`, restart the Odin MCP server before retrying tools.

Odin uses two database paths today:

- **Direct PostgreSQL** (any provider — Neon, Railway, self-hosted, local Supabase Postgres, etc.) for `odin.apply_migrations`:
  ```env
  DATABASE_URL=postgresql://user:password@host:5432/dbname
  ```

- **Supabase runtime + management API** for full persistent Odin workflow state plus archival:
  ```env
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SECRET_KEY=your-secret-key
  SUPABASE_ACCESS_TOKEN=your-management-api-access-token
  ```

`DATABASE_URL` takes priority inside `odin.apply_migrations`. It does not replace Supabase-backed workflow state for the main runtime.

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
| `odin.get_skill_proposal_queue` | Inspect repeated unresolved learning topics that may warrant a generated skill draft |
| `odin.get_skill_proposals` | List drafted, approved, rejected, or published skill proposal records |
| `odin.record_skill_proposal_draft` | Persist a drafted generated-skill proposal and run deterministic validation |
| `odin.record_skill_proposal_decision` | Approve or reject a drafted skill proposal |
| `odin.publish_skill_proposal` | Publish an approved skill proposal into `.odin/skills/generated/` |
| `odin.sync_skill_proposal_candidates` | Persist the current deterministic proposal queue for later review/approval workflows |
| `odin.get_feature_status` | Inspect feature state with workflow details |
| `odin.verify_claims` | Check claim verification status |
| `odin.get_claims_needing_review` | List claims waiting for watcher review |
| `odin.record_watcher_review` | Record the watcher verdict for an escalated claim |
| `odin.archive_feature_release` | Archive release artifacts to Supabase Storage |
| `odin.explore_knowledge` | Explore knowledge clusters, cross-domain bridges, and domain stats |
| `odin.apply_migrations` | Apply pending database migrations (auto-detects existing schema) |

## Dashboard

`@plazmodium/odin` ships the MCP runtime only. It does **not** bundle the Next.js dashboard.

If you want the dashboard UI for feature health, learnings, claims, and eval visibility, use the full Odin repository:

- Repo: https://github.com/Plazmodium/odin-workflow
- Dashboard app: https://github.com/Plazmodium/odin-workflow/tree/dev/dashboard

The dashboard is a separate app and is not included in the npm tarball.

## Configuration

Odin uses two files:

**`.odin/config.yaml`** (committed) — project-level config with env var interpolation:

```yaml
runtime:
  mode: in_memory       # quick-start mode; switch to "supabase" for persistent workflow state

database:
  url: ${DATABASE_URL}  # used by odin.apply_migrations for direct PostgreSQL

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
  provider: none
```

**`.env`** (uncommitted) — secret values:

```env
# Option A: Direct PostgreSQL for odin.apply_migrations
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option B: Supabase runtime + management API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_ACCESS_TOKEN=your-management-api-access-token
```

### Runtime Modes

- **`supabase`** — Full persistent workflow state backed by Supabase. Requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Enable `archive.provider: supabase` when you want release archival too.
- **`in_memory`** — Zero-dependency smoke-test mode. State is lost when the process exits. Useful for testing MCP wiring and prompt flow before provisioning Supabase.

> **Note on `DATABASE_URL`**: today it powers `odin.apply_migrations`, including local PostgreSQL or local Supabase Postgres access. The main Odin workflow runtime still uses the Supabase workflow-state adapter when `runtime.mode: supabase`.

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
   - .odin/ODIN.md (framework-level rules)
   - context.agent.role_summary
   - context.agent.constraints
   - context.agent.definition_markdown
   - context.development_evals.harness_prompt_block
3. Keep context.development_evals.status_summary visible to the operator
4. Do not treat eval instructions as a replacement for formal verification, Semgrep, tests, runtime checks, or watcher checks
```

Canonical eval-aware orchestration snippet:

```text
When orchestrating Odin phases:
1. Read `.odin/ODIN.md` once so the harness has the framework-level rules in project context.
2. Call odin.prepare_phase_context({ feature_id, phase, agent_name }).
3. Build the active agent prompt from:
   - context.agent.role_summary
   - context.agent.constraints
   - context.agent.definition_markdown
   - context.development_evals.harness_prompt_block
4. Use odin.get_development_eval_status({ feature_id }) when you need focused eval state.
5. Record eval artifacts/gates with odin.record_eval_plan, odin.record_eval_run, and odin.record_quality_gate.
6. Never let Development Evals override odin.verify_design, odin.run_review_checks, tests, runtime verification, or watcher checks.
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
6. **Proposal surfacing**: Repeated unresolved tags can be inspected via `odin.get_skill_proposal_queue` to identify candidate topics for governed skill drafting
7. **Proposal persistence**: `odin.sync_skill_proposal_candidates` snapshots the current candidate queue into workflow state so later approval/draft flows and dashboard surfaces can build on stable relational state
8. **Governed skill workflow**: draft generation, approval, and publish happen through `odin.record_skill_proposal_draft`, `odin.record_skill_proposal_decision`, and `odin.publish_skill_proposal` rather than automatic built-in self-modification

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
