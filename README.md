<p align="center">
  <img src="assets/odin-logo.svg" alt="Odin Logo" width="128" height="128">
</p>

<h1 align="center">Odin</h1>

<p align="center">
  <strong>Specification-Driven Development for AI-Assisted Coding</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.6.1--beta-orange" alt="Version">
  <img src="https://img.shields.io/badge/workflow-11_phase-blue" alt="11-phase workflow">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

## Framework Guide

Start with [ODIN.md](ODIN.md). It is the shipped guide for how Odin works.

## What Odin Solves

When developers use AI coding assistants without proper specifications:
- AI hallucinates business logic and data structures
- code contradicts requirements within the same session
- developers spend more time fixing AI mistakes than coding
- no single source of truth exists between spec and implementation

Odin fixes that with a spec-first workflow, adaptive complexity, explicit quality gates, persistent learnings, health metrics, and workflow verification.

## Feature-Oriented By Design

Odin is built around a simple idea: ship software **by feature**, not by scattering dozens of tiny concurrent coding tasks across the codebase.

A feature in Odin moves through a defined workflow:
- a branch is created for the feature
- requirements and specification are made explicit
- implementation happens against that approved spec
- verification runs through the workflow
- a human reviews the result at the pull request stage

By default, Odin runs in a `guarded` automation mode: agents can prepare and record work, but the human boundary remains at PR creation/review/merge unless a project explicitly opts into limited `auto_pr` behavior.

This is intentional. Odin is not trying to become a swarm scheduler, IDE replacement, or background agent platform. Its job is to help an AI coding assistant build a **coherent feature slice** with clear contracts, strong guardrails, and a clean human checkpoint at the end.

### What Odin Optimizes For

- **Feature-level flow** — one feature branch, one feature spec, one feature moving through the workflow
- **Spec discipline** — implementation follows an approved spec instead of drifting through ad-hoc prompts
- **Clear accountability** — each phase produces artifacts, checks, and state transitions that can be inspected later
- **Human review at the right boundary** — by default the PR is the final approval point for integration and merge decisions
- **Low coordination overhead** — less time orchestrating agent swarms, more time getting a feature to done

### What Odin Does Not Try To Be

Odin is **not** designed around:
- parallel sub-agents editing different parts of the same feature at the same time
- intra-feature task swarms with isolated worktrees and merge-back coordination
- continuous spec mutation while implementation is already underway
- autonomous branch merging by agents
- replacing normal software development structure with constant micro-dispatch

Those patterns can be powerful in some systems, but they also add coordination state, conflict handling, and workflow complexity. Odin deliberately stays narrower.

### Where Parallelism Belongs In Odin

If work should happen in parallel, Odin prefers parallelism at the **feature level**, not inside a single feature.

That means:
- split large initiatives into multiple independent features
- give each feature its own branch and workflow
- review each feature as a coherent unit

This keeps Odin aligned with how many teams already build software: define the feature, implement the feature, review the feature, merge the feature.

In short: **Odin is a feature workflow system, not a sub-task swarm orchestrator.**

## What Odin Includes

- **11-phase workflow** with Product and Reviewer added to the core path
- **11 workflow and support agents** with explicit responsibilities
- **Watcher verification** using deterministic policy checks plus LLM escalation for watched phases
- **Semgrep-backed review phase** with severity-based blocking behavior
- **Supabase-backed learnings and EVALS** for workflow state, memory, and health
- **Odin MCP Runtime** — single-install TypeScript MCP server as the agent control plane
- **Memory Palace** — semantic learning propagation with domain matching, cross-feature knowledge corridors, and resonance scoring
- **Governed skill proposals** — repeated unresolved learnings surface draft-ready skill candidates with deterministic validation, approval, and project-local publish flow
- **TLA+ formal verification** — opt-in design verification for state machine specs via tla-precheck
- **Dashboard support** for claims, watcher verification, security findings, and the 11-phase model
- **Internal terse execution profile** — Builder / Reviewer / Integrator / Release can use bounded terse operational chatter while PRDs, specs, tasks, docs, changelogs, and release notes stay in normal human-readable prose

## Prerequisites

- **Node.js 18+** and **npm**
- **AI coding assistant** with MCP support (Amp, Claude Code, Cursor, etc.)
- **Supabase project** if you want persistent workflow state, archival, and the dashboard
- **PostgreSQL database** only if you want to use direct `DATABASE_URL` for `odin.apply_migrations`

> **Runtime contract**: today the full persistent Odin runtime uses the Supabase workflow-state adapter. Direct PostgreSQL via `DATABASE_URL` currently powers `odin.apply_migrations`, including local PostgreSQL or local Supabase Postgres setups.

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/Plazmodium/odin-workflow.git
cd odin-workflow
```

### 2. Install & bootstrap the Odin Runtime

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

Run the bootstrap commands from `odin-workflow/runtime`:

```bash
# For Amp / Claude Code / OpenCode from this repo checkout:
npm run init:project -- --project-root /path/to/your/project --tool amp --distribution source --write-mcp

# For Codex from this repo checkout:
npm run init:project -- --project-root /path/to/your/project --tool codex --distribution source --write-mcp
```

If you prefer to run the bootstrap from inside your target project directory, call the built CLI directly:

```bash
cd /path/to/your/project
node /absolute/path/to/odin-workflow/runtime/dist/cli.js init --tool amp --distribution source --write-mcp
```

This creates `.odin/config.yaml`, `.odin/ODIN.md`, `.odin/agents/definitions/`, `.odin/skills/`, `.env.example`, and your harness config file. For OpenCode, that file is `opencode.json`. Secrets stay in `.env` — never in the MCP config.

Important: Odin now bootstraps with `runtime.mode: in_memory` by default so you can verify MCP wiring before provisioning external services. Switch `.odin/config.yaml` to `runtime.mode: supabase` when you are ready for persistent workflow state.

If you are developing Odin itself from this repo, use the repo-checkout `--distribution source` flow shown above.

### 3. Optional: Ralph Loop

Ralph Loop is the external Odin supervisor for bounded autonomous polling.

Current supported paths:
- Release auto-PR handoff when `automation.mode: auto_pr` allows it
- Release closeout after a human merge is recorded
- Optional child-command execution for phases 5-8 when `--subagent-command-json` / `RALPH_SUBAGENT_COMMAND_JSON` is configured
- Phase-specific `response_style` hints so internal execution chatter can be terse without turning final artifacts into caveman prose

From the repo root:

```bash
npm run ralph:tick -- --project-root /path/to/your/project
npm run ralph:watch -- --project-root /path/to/your/project --interval-ms 30000
```

See `loop/README.md` and `docs/guides/RALPH-LOOP.md` for the operator runbook, child-command protocol, response-style behavior, prerequisites, and smoke steps.

For Claude Code / Amp, use:

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

For Claude Code / Amp from a repo checkout today, use:

```json
{
  "mcpServers": {
    "odin": {
      "command": "node",
      "args": ["/absolute/path/to/odin-workflow/runtime/dist/server.js"],
      "env": {
        "ODIN_PROJECT_ROOT": "/absolute/path/to/your/project"
      }
    }
  }
}
```

For OpenCode, use:

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

For OpenCode from a repo checkout today, use:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "odin": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/to/odin-workflow/runtime/dist/server.js"
      ],
      "enabled": true,
      "environment": {
        "ODIN_PROJECT_ROOT": "/absolute/path/to/your/project"
      }
    }
  }
}
```

| Tool | Where to add it |
|------|----------------|
| **Amp** | `settings.json` → `mcpServers` |
| **Claude Code** | `.mcp.json` → `mcpServers` |
| **OpenCode** | `opencode.json` → `mcp` |
| **Cursor** | Settings → MCP Servers |
| **Codex** | `.codex/config.toml` (`[mcp_servers.odin]`) |

See [runtime/README.md](runtime/README.md) for full configuration, available tools, adapter architecture, and the recommended harness flow using `.odin/ODIN.md` plus `odin.prepare_phase_context`.

Maintainers preparing the npm release should use [docs/guides/NPM-PUBLISH.md](docs/guides/NPM-PUBLISH.md).

### 4. Add your database credentials

```bash
cp .env.example .env
# Edit .env with your database credentials
```

Use the project root `.env` or `.env.local` file that lives next to your MCP config and `.odin/`. Odin does not read env files from nested app directories.

Runtime config is loaded once at server startup. If you change `.env`, `.env.local`, or `.odin/config.yaml`, restart the Odin MCP server before retrying tools.

Choose one:

- **Direct PostgreSQL** for `odin.apply_migrations` (any provider, including local PostgreSQL):
  ```env
  DATABASE_URL=postgresql://user:password@host:5432/dbname
  ```

- **Supabase** for full persistent runtime state plus archival:
  ```env
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SECRET_KEY=your-secret-key
  SUPABASE_ACCESS_TOKEN=your-management-api-access-token
  ```

`DATABASE_URL` takes priority inside `odin.apply_migrations`. It does not replace the Supabase workflow-state adapter for the main Odin runtime. For Supabase, generate the access token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).

### Optional: Enable TLA+ design verification

If you want `odin.verify_design` for state-heavy features, install `tla-precheck` in the **target project root** that Odin runs against:

```bash
npm install -D tla-precheck
```

- Requires **Java 17+** locally
- Leave `formal_verification.provider: none` if you do not need it; Odin still loads normally
- To enable it, set this in `.odin/config.yaml`:

```yaml
formal_verification:
  provider: tla-precheck
  timeout_seconds: 120
```

Typical flow: write a `.machine.ts` file for a stateful design, then call `odin.verify_design` with the file's relative `machine_path` during Architect/Guardian work.

### 5. Apply database migrations

Odin applies its schema automatically via the runtime:

```
Use odin.apply_migrations to set up the database schema.
```

The tool auto-detects existing schemas on first run. Use `dry_run: true` to preview. See [docs/guides/SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md) for manual setup or troubleshooting.

### 6. Start using Odin

Point your AI tool at [ODIN.md](ODIN.md) and use it as the framework guide for real feature work.

## The 11-Phase Workflow

| Phase | Agent | Responsibility | Watched? |
|-------|-------|----------------|----------|
| 0 | Planning | Human request / planning setup | No |
| 1 | Product | PRD generation | No |
| 2 | Discovery | Technical context gathering | No |
| 3 | Architect | Technical specification | No |
| 4 | Guardian | PRD + spec review | No |
| 5 | Builder | Implementation | Yes |
| 6 | Reviewer | SAST/security review | No |
| 7 | Integrator | Build and runtime verification | Yes |
| 8 | Documenter | Documentation updates | No |
| 9 | Release | PR creation and archival | Yes |
| 10 | Complete | Feature complete | No |

Every feature goes through all 11 phases. Complexity level changes the depth of each phase, not whether the phase runs.

### Development Evals Summary

- **Product** defines success, non-goals, and failure shape
- **Discovery** captures happy-path, negative, and regression-seed scenarios
- **Architect** records `eval_plan` for L2/L3 work; L1 still needs minimal acceptance or regression coverage
- **Guardian** decides `eval_readiness` before Builder starts when required
- **Reviewer** records `eval_run`; **Integrator** resolves any `partial` eval state with runtime evidence
- Development Evals are additive only - they do not replace `odin.verify_design`, `odin.run_review_checks`, tests, runtime verification, or Watcher checks

See [ODIN.md](ODIN.md) for the full protocol.

## Adaptive Complexity

| Level | Name | Use When |
|-------|------|----------|
| **L1** | The Nut | Bug fixes, tiny tweaks, single-file changes |
| **L2** | The Feature | Standard features, APIs, UI work |
| **L3** | The Epic | Multi-file systems, major refactors, large workflow changes |

## Agents

All workflow agents live in `agents/definitions/`:

- `planning.md`
- `product.md`
- `discovery.md`
- `architect.md`
- `guardian.md`
- `builder.md`
- `reviewer.md`
- `integrator.md`
- `documenter.md`
- `release.md`
- `watcher.md`
- `_shared-context.md`

See [agents/definitions/README.md](agents/definitions/README.md) for the agent index.

## Skills System

Skills live in `agents/skills/` and are organized by domain:

- frontend
- backend
- database
- testing
- devops
- api
- architecture
- generic-dev

See [docs/reference/SKILLS-SYSTEM.md](docs/reference/SKILLS-SYSTEM.md).

## Dashboard

The dashboard lives in `dashboard/` and supports the full Odin workflow:

- 11-phase feature timeline
- watcher verification panel
- security findings panel
- learnings and EVALS visualization

Use the Vercel button for a quick deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Plazmodium/odin-workflow/tree/main/dashboard&env=SUPABASE_URL,SUPABASE_SECRET_KEY,NEXT_PUBLIC_SUPABASE_URL&envDescription=Supabase%20credentials&project-name=odin-dashboard)

> **Note:** This deploys the official Odin dashboard to your Vercel account. If you've forked/cloned this repo and made customizations, connect your fork directly via the [Vercel dashboard](https://vercel.com/new) instead.

Or deploy manually — see [dashboard/README.md](dashboard/README.md).

## Project Structure

```text
odin-workflow/
├── ODIN.md
├── README.md
├── agents/
│   ├── definitions/
│   └── skills/
├── runtime/               # Odin MCP Runtime (TypeScript)
├── docs/
│   ├── framework/
│   ├── guides/
│   └── reference/
├── dashboard/
├── migrations/
├── templates/
└── examples/
```

## Documentation

| Document | Description |
|----------|-------------|
| [ODIN.md](ODIN.md) | **Start here** — Complete framework guide |
| [SDD-framework.md](docs/framework/SDD-framework.md) | Spec-Driven Development explained |
| [multi-agent-protocol.md](docs/framework/multi-agent-protocol.md) | Multi-agent architecture |
| [SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md) | Database setup guide |
| [example-workflow.md](docs/guides/example-workflow.md) | Complete worked example |
| [SKILLS-SYSTEM.md](docs/reference/SKILLS-SYSTEM.md) | Skills documentation |
| [HYBRID-ORCHESTRATION-PATTERN.md](docs/reference/HYBRID-ORCHESTRATION-PATTERN.md) | Why agents can't use MCP directly |

## Key Concepts

### Spec-First Development
Never write implementation code without an approved specification. The spec is the contract.

### Context Pulling (not Pushing)
AI agents fetch what they need via MCP instead of you copy-pasting files into prompts.

### Quality Gates
Guardian agent reviews every spec before implementation. No code without approval.

### Learnings System
Capture insights during development. High-confidence learnings (>=0.80) propagate to preserve knowledge.

### EVALS
Monitor feature health (efficiency + quality) and system health over time.

## AI Tool Compatibility

| Tool | MCP Support | Agent Spawning | Status |
|------|-------------|----------------|--------|
| **Amp** | Native | Task tool | Full support |
| **Claude Code** | Native | Task tool | Full support |
| **OpenCode** | Native | Task tool | Full support |
| **Cursor** | Recent | Composer | Full support |
| **Codex CLI** | Yes | Custom agents | Full support |
| **Windsurf** | Limited | Cascade | Partial |
| **Continue.dev** | Yes | Custom agents | Full support |
| **Aider** | No | None | Manual mode |

## Status

Odin is in active beta. The current workflow is implemented and dogfooded.

### What Works

- 11-phase workflow with database-enforced sequential phase transitions
- Odin MCP Runtime — single-install TypeScript MCP server (30 tools, including self-service migrations and governed skill-proposal workflow)
- Memory Palace — semantic learning propagation with domain matching, cross-feature knowledge corridors, and resonance scoring
- Governed skill proposal pipeline — repeated unresolved tags move through candidate, draft, approval, and publish into `.odin/skills/generated/`
- TLA+ formal verification — opt-in design verification for state machine specs
- Dashboard with 11-phase timeline, watcher verification, security findings, learnings
- 36+ skills across frontend, backend, database, testing, devops, API, architecture

## Contributing

As Odin is currently in beta, contributions are closed for now. If you have feedback, ideas, or find issues, please [open an issue](https://github.com/Plazmodium/odin-workflow/issues) and we'll look into it.

## License

MIT — see [LICENSE](LICENSE)

---

**Odin evolves through dogfooding.** This framework follows its own specification-driven process.
