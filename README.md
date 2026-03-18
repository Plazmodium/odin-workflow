<p align="center">
  <img src="assets/odin-logo.svg" alt="Odin Logo" width="128" height="128">
</p>

<h1 align="center">Odin</h1>

<p align="center">
  <strong>Specification-Driven Development for AI-Assisted Coding</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.3.0--beta-orange" alt="Version">
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

## What Odin Includes

- **11-phase workflow** with Product and Reviewer added to the core path
- **11 workflow and support agents** with explicit responsibilities
- **Watcher verification** using deterministic policy checks plus LLM escalation for watched phases
- **Semgrep-backed review phase** with severity-based blocking behavior
- **Supabase-backed learnings and EVALS** for workflow state, memory, and health
- **Odin MCP Runtime** — single-install TypeScript MCP server as the agent control plane
- **Memory Palace** — semantic learning propagation with domain matching and cross-feature knowledge corridors
- **TLA+ formal verification** — opt-in design verification for state machine specs via tla-precheck
- **Dashboard support** for claims, watcher verification, security findings, and the 11-phase model

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/Plazmodium/odin-workflow.git
cd odin-workflow
```

### 2. Configure MCP

At minimum, configure the **Odin Runtime** MCP server. It provides all domain-level workflow tools (start features, prepare phase context, record artifacts, capture learnings, run reviews, and more).

```bash
cd runtime
npm install
npm run build
```

Bootstrap your project config (recommended):

```bash
# For Amp / Claude Code / OpenCode:
npm run init:project --prefix runtime -- --project-root /path/to/your/project --tool amp --write-mcp

# For Codex:
npm run init:project --prefix runtime -- --project-root /path/to/your/project --tool codex --write-mcp
```

This creates `.odin/config.yaml`, `.env.example`, and your harness config file. Secrets stay in `.env` — never in the MCP config.

Or manually add this MCP server entry to your tool's settings file:

```json
{
  "odin": {
    "command": "node",
    "args": ["/absolute/path/to/runtime/dist/server.js"],
    "env": {
      "ODIN_PROJECT_ROOT": "/absolute/path/to/your/project"
    }
  }
}
```

| Tool | Where to add it |
|------|----------------|
| **Amp** | `settings.json` → `mcpServers` |
| **Claude Code** | `.mcp.json` → `mcpServers` |
| **OpenCode** | `.mcp.json` → `mcpServers` |
| **Cursor** | Settings → MCP Servers |
| **Codex** | `.codex/config.toml` (`[mcp_servers.odin]`) |

See [runtime/README.md](runtime/README.md) for full configuration, available tools, and adapter architecture.

### 3. Apply the migrations

Odin can apply its database migrations automatically via the runtime:

```
Use odin.apply_migrations to set up the database schema.
```

The tool works with any PostgreSQL provider. Configure one of these in your `.env`:

```env
# Option A: Direct PostgreSQL (Neon, Railway, self-hosted, etc.)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option B: Supabase Management API
SUPABASE_ACCESS_TOKEN=sbp_your-access-token
```

`DATABASE_URL` takes priority if both are set. For Supabase, generate the access token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).

The tool reads migration files bundled with the runtime, applies any that haven't been run yet, and tracks them in an `odin_migrations` table. On first run against an existing database, it auto-detects the schema and seeds the tracking table so nothing is re-applied. Use `dry_run: true` to preview without applying.

See [docs/guides/SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md) for manual setup or troubleshooting.

### 4. Start using Odin

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
- Odin MCP Runtime — single-install TypeScript MCP server (13 tools, including self-service migrations)
- Memory Palace — semantic learning propagation with domain matching and cross-feature knowledge corridors
- TLA+ formal verification — opt-in design verification for state machine specs
- Dashboard with 11-phase timeline, watcher verification, security findings, learnings
- 36+ skills across frontend, backend, database, testing, devops, API, architecture

## Contributing

As Odin is currently in beta, contributions are closed for now. If you have feedback, ideas, or find issues, please [open an issue](https://github.com/Plazmodium/odin-workflow/issues) and we'll look into it.

## License

MIT — see [LICENSE](LICENSE)

---

**Odin evolves through dogfooding.** This framework follows its own specification-driven process.
