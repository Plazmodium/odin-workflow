<p align="center">
  <img src="assets/odin-logo.svg" alt="Odin Logo" width="128" height="128">
</p>

<h1 align="center">Odin</h1>

<p align="center">
  <strong>Specification-Driven Development for AI-Assisted Coding</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.1--beta-orange" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

## The Problem

When developers use AI coding assistants without proper specifications:
- AI hallucinates business logic and data structures
- Code contradicts requirements within the same session
- Developers spend more time fixing AI mistakes than coding
- No single source of truth exists between spec and implementation

## The Solution: Odin

Odin is an 8-phase workflow framework that makes AI coding assistants actually useful:

1. **Spec-first**: Every feature starts with a specification, not code
2. **Adaptive complexity**: Specs scale from 5-minute bug fixes (L1) to multi-day epics (L3)
3. **8 specialized agents**: Each phase has a dedicated agent with clear responsibilities
4. **Quality gates**: Guardian agent reviews specs before any code is written
5. **Learnings system**: Capture insights, evolve knowledge, propagate to future sessions
6. **EVALS**: Monitor feature and system health over time

## Quick Start

### Prerequisites

- **Supabase account** — [Create one free](https://supabase.com)
- **AI coding tool with MCP support** — Claude Code, Cursor, OpenCode, etc.
- **Node.js 18+** — For the dashboard (optional)

### 1. Clone this repo

```bash
git clone https://github.com/Plazmodium/odin-workflow.git
cd odin-workflow
```

### 2. Configure your AI tool

Add the Supabase MCP server to your tool's configuration:

**Claude Code / OpenCode** (`.mcp.json`):
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

### 3. Set up Supabase

Once MCP is configured, ask your AI assistant to run the migrations:

> "Apply the Odin migrations from the migrations/ folder to my Supabase project"

The AI will use the Supabase MCP to apply all 4 migration files automatically.

**Manual alternative** — run via Supabase CLI or Dashboard SQL Editor:

```bash
# Using Supabase CLI
supabase db push --db-url "postgresql://..." < migrations/001_schema.sql
supabase db push --db-url "postgresql://..." < migrations/002_functions.sql
supabase db push --db-url "postgresql://..." < migrations/003_views.sql
supabase db push --db-url "postgresql://..." < migrations/004_seed.sql
```

See [docs/guides/SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md) for detailed instructions.

### 4. Start using Odin

Point your AI tool to read `ODIN.md` and you're ready to go!

## The 8-Phase Workflow

| Phase | Agent | What Happens |
|-------|-------|--------------|
| 0 | **Planner** | Epic decomposition (L3 only) |
| 1 | **Discovery** | Gather requirements from vague inputs |
| 2 | **Architect** | Draft specification with complexity assessment |
| 3 | **Guardian** | Review spec from 3 perspectives, approve or request changes |
| 4 | **Builder** | Implement code per approved spec |
| 5 | **Integrator** | Verify build and runtime behavior |
| 6 | **Documenter** | Generate/update documentation |
| 7 | **Release** | Create PR and archive specs |

**Every feature goes through all 8 phases.** Complexity level (L1/L2/L3) affects depth, not which phases run.

See [ODIN.md](ODIN.md#the-8-phase-workflow) for full workflow details.

## Adaptive Complexity

| Level | Name | Use When | Spec Time |
|-------|------|----------|-----------|
| **L1** | The Nut | Bug fixes, single-file changes | 5-10 min |
| **L2** | The Feature | New features, API endpoints | 20-30 min |
| **L3** | The Epic | Multi-file refactors, new subsystems | 1-2 hours |

The Architect agent assesses complexity using 3 dimensions (Scope, Risk, Integration) scored 1-5 each.

See [ODIN.md](ODIN.md#adaptive-complexity) for complexity scoring details.

## The 9 Agents

All agents live in `agents/definitions/`:

| Agent | File | Role |
|-------|------|------|
| Planner | `planning.md` | Epic decomposition |
| Discovery | `discovery.md` | Requirements gathering |
| Architect | `architect.md` | Specification drafting |
| Guardian | `guardian.md` | Multi-perspective review |
| Builder | `builder.md` | Code implementation |
| Integrator | `integrator.md` | Build & runtime verification |
| Documenter | `documenter.md` | Documentation generation |
| Release | `release.md` | PR creation & archival |

All agents inherit shared context from `_shared-context.md`.

See [ODIN.md](ODIN.md#the-8-agents) for agent details.

## Skills System

Skills are domain-specific knowledge modules in `agents/skills/`:

| Category | Skills |
|----------|--------|
| **Frontend** | nextjs-dev, react-patterns, tailwindcss, angular, vue, svelte, astro, htmx, alpine |
| **Backend** | nodejs-express, nodejs-fastify, python-fastapi, python-django, golang-gin |
| **Database** | supabase, postgresql, prisma-orm, mongodb, redis |
| **Testing** | jest, vitest, playwright, cypress |
| **DevOps** | docker, kubernetes, terraform, github-actions, aws |
| **API** | rest-api, graphql, trpc, grpc |
| **Architecture** | clean-architecture, DDD, event-driven, microservices |

The orchestrator auto-detects your tech stack and injects relevant skills into agent prompts.

See [docs/reference/SKILLS-SYSTEM.md](docs/reference/SKILLS-SYSTEM.md) for full skills documentation.

## Dashboard (Optional)

Monitor your workflow with a real-time web dashboard:

- System health gauge and alerts
- Feature progress tracking
- Learnings evolution graph
- EVALS performance metrics

**One-click deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Plazmodium/odin-workflow/tree/main/dashboard&env=SUPABASE_URL,SUPABASE_SECRET_KEY,NEXT_PUBLIC_SUPABASE_URL&envDescription=Supabase%20credentials&project-name=odin-dashboard)

> **Note:** This deploys the official Odin dashboard to your Vercel account. If you've forked/cloned this repo and made customizations, connect your fork directly via the [Vercel dashboard](https://vercel.com/new) instead.

Or deploy manually — see [dashboard/README.md](dashboard/README.md).

## Project Structure

```
odin-workflow/
├── ODIN.md                 # Complete framework guide (start here)
├── agents/
│   ├── definitions/        # 8 agent prompts
│   └── skills/             # 36+ domain skills
├── docs/
│   ├── framework/          # Core concepts
│   ├── guides/             # How-to guides
│   └── reference/          # Reference material
├── dashboard/              # Next.js monitoring app
├── migrations/             # Supabase SQL files
├── templates/              # Spec templates
└── examples/               # Worked examples
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
| **Claude Code** | Native | Task tool | Full support |
| **OpenCode** | Native | Task tool | Full support |
| **Cursor** | Recent | Composer | Full support |
| **Codex CLI** | Yes | Custom agents | Full support |
| **Windsurf** | Limited | Cascade | Partial |
| **Continue.dev** | Yes | Custom agents | Full support |
| **Aider** | No | None | Manual mode |

## Status

**Version**: 0.1.1-beta

Odin is in active development. The workflow is stable and used in production, but APIs may change.

## Contributing

As Odin is currently in beta, contributions are closed for now. If you have feedback, ideas, or find issues, please [open an issue](https://github.com/Plazmodium/odin-workflow/issues) and we'll look into it.

## License

MIT — see [LICENSE](LICENSE)

---

**Odin evolves through dogfooding.** This framework follows its own specification-driven process.
