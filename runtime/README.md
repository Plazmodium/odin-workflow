# Odin Runtime

`@plazmodium/odin` is the Odin MCP server package. It gives your AI coding tool one MCP server named `odin` with the 11-phase workflow, migrations, review checks, learnings, and workflow-state integration.

In this package, "runtime" means the local MCP-facing server that exposes Odin workflow tools. Agent execution belongs to the host session, child-agent harness, or Ralph Loop.

This README is the package setup and reference guide. If you want the user-first onboarding flow, start with the repo [README.md](../README.md) or [docs/guides/GETTING-STARTED.md](../docs/guides/GETTING-STARTED.md).

## Day 1 Setup

Run `init` from the root of the project where Odin should create `.odin/`.

### Auto-configured tools

| Tool | Command | Written file |
|------|---------|--------------|
| **Codex** | `npx -y @plazmodium/odin init --tool codex --write-mcp` | `.codex/config.toml` |
| **OpenCode** | `npx -y @plazmodium/odin init --tool opencode --write-mcp` | `opencode.json` |
| **Claude Code** | `npx -y @plazmodium/odin init --tool claude-code --write-mcp` | `.mcp.json` |
| **Amp** | `npx -y @plazmodium/odin init --tool amp --write-mcp` | `.mcp.json` |

### Generic snippet path

| Tool type | Command | Result |
|-----------|---------|--------|
| **Cursor** | `npx -y @plazmodium/odin init --tool generic` | Prints the MCP server block to paste into Cursor |
| **Junie / other tools** | `npx -y @plazmodium/odin init --tool generic` | Prints the MCP server block when your tool can wire a local MCP server |

Important:

- `--project-root` is optional. If you omit it, `init` uses your current working directory.
- `runtime.mode: in_memory` is the default bootstrap mode so you can verify MCP wiring before adding external services.
- Normal users do not need to clone `odin-workflow` to use the package.

## What `init` Creates

- `.odin/config.yaml` - runtime configuration
- `.odin/ODIN.md` - local workflow guide for the AI agent
- `.odin/managed-assets.json` - update metadata for managed Odin files
- `.odin/skills/.gitkeep` - placeholder for project-local skill overrides
- `.env.example` - environment template
- your MCP config file when auto-config is supported for that tool

Odin does not copy broad managed workflow assets by default. Run `odin init --sync-managed-assets` when you intentionally want packaged `.odin/agents/definitions/` and built-in skills copied into the target project for local overrides or inspection.

## After `init`

1. Restart your AI tool so it reloads MCP servers.
2. Confirm the `odin` server is available.
3. Tell the AI agent to use the `odin` MCP tools for workflow state and phase context. `odin init` also writes `.odin/ODIN.md` as the local workflow guide the agent can consult.
4. If database credentials are configured, ask the AI agent to run `odin.apply_migrations`.

Suggested first prompt:

```text
Confirm the `odin` MCP tools are available. Use `.odin/ODIN.md` as your workflow guide, then summarize what Odin added to this repo, whether broad managed workflow assets were synced locally, and whether this project is still in `in_memory` mode or ready for migrations.
```

Suggested migrations prompt:

```text
If Odin database credentials are configured, run `odin.apply_migrations`. If they are not configured, tell me what is missing and leave Odin in `in_memory` mode.
```

Important:
`.odin/ODIN.md` is for the AI agent. Humans should not treat it as the onboarding guide.

## One-Time Setup vs Ongoing Use

- `odin init` is a one-time project bootstrap step.
- You do not repeat `init` for every feature.
- In the normal flow, your AI tool's orchestrating session creates the feature branch first and then records the feature in Odin.

Suggested start prompt:

```text
Use Odin in this repository. Confirm the `odin` MCP tools are available and help me start a new feature for: <plain English feature request>. If you need my author name, initials, or any other missing metadata, ask me before starting.
```

### Manual fallback: `odin start-feature`

Most users do not need this command directly. It exists as a helper when you want to start the feature record manually or your harness does not automate that step yet.

From your project root:

```bash
npx -y @plazmodium/odin start-feature \
  --id AUTH-001 \
  --name "Login" \
  --complexity-level 2 \
  --severity ROUTINE \
  --author "Jane Doe" \
  --dev-initials jd
```

`start-feature` defaults `--project-root` to the current directory, creates or switches to the feature branch first, then records the feature through the runtime.

## Database Paths

Odin supports three useful setup stages:

1. **`in_memory`**
- zero-dependency first run
- no persistent workflow state
- good for validating MCP wiring and prompt flow

1. **Direct PostgreSQL for migrations**
- powers `odin.apply_migrations`
- uses `DATABASE_URL`

1. **Supabase for persistent workflow state**
- powers the main persisted Odin runtime
- uses `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
- add `SUPABASE_ACCESS_TOKEN` when you want migration management through Supabase APIs

### `.env`

Use the project root `.env` or `.env.local` that lives next to `.odin/` and your MCP config.

Example:

```env
# Option A: direct PostgreSQL for odin.apply_migrations
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option B: Supabase persistent runtime
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_ACCESS_TOKEN=your-management-api-access-token
```

Restart the Odin MCP server after changing `.env`, `.env.local`, or `.odin/config.yaml`.

## Manual MCP Wiring

Use this only when you do not want `init --write-mcp` to write the config for you.

### Claude Code / Amp

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

### OpenCode

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

### Codex

```toml
[mcp_servers.odin]
command = "npx"
args = ["-y", "@plazmodium/odin", "mcp"]
env = { ODIN_PROJECT_ROOT = "/absolute/path/to/your/project" }
```

### Cursor / generic tools

Use the same `command`, `args`, and `env` values in whatever MCP settings surface your tool exposes.

For Junie and other emerging tools, use the same generic server block when your environment exposes local MCP server wiring.

## Minimal Runtime Config

`.odin/config.yaml` starts like this:

```yaml
runtime:
  mode: in_memory

# Switch to `supabase` when you want persistent workflow state.
# runtime:
#   mode: supabase

supabase:
  url: ${SUPABASE_URL}
  secret_key: ${SUPABASE_SECRET_KEY}

skills:
  paths:
    - .odin/skills
  defaults: []
  auto_detect: true

review:
  provider: semgrep

automation:
  mode: guarded
  allowed_base_branches: []
  require_green_checks: true
  require_clean_policy_checks: true
  require_no_open_blockers: true
  require_watched_claims_verified: true
  paused: false
  kill_switch: false
  merge_strategy: squash

# `auto_pr` is opt-in and only works on allowlisted base branches.
# `auto_merge` is reserved for future use and is not supported yet.

attestation:
  # advisory warns; strict blocks configured phases unless required execution and prompt-realization proof exists.
  # Strict-mode overrides must be handled through an explicit break-glass process, not normal phase completion.
  mode: advisory
  require_execution_phases: ["5", "6", "7", "9"]
  require_prompt_realization_phases: ["5", "6", "7", "9"]

# formal_verification:
#   provider: tla-precheck    # requires: Java 17+, npm install -D tla-precheck
#   timeout_seconds: 120

archive:
  provider: none

# Enable Supabase archival after switching workflow state to remote Supabase.
# archive:
#   provider: supabase
```

Odin runtime reads `.odin/config.yaml`. A `.odin/config.toml` file is not active runtime config; `.codex/config.toml` is only Codex MCP host wiring.

## Harness Execution Modes

Odin distinguishes workflow telemetry from full phase-agent proof.

- **Full Odin direct launch**: the harness invokes the canonical phase agent definition and records `odin.record_phase_agent_launch`, `odin.register_phase_execution`, and `odin.register_phase_realization` when strict policy requires them.
- **Full Odin subagent launch**: the harness spawns a child/subagent from the `phase_prompt_manifest` returned by `odin.prepare_phase_context`, then records the same launch, execution, and realization proof.
- **Reduced-fidelity inline work**: the orchestrator performs the phase inline and records `odin.record_phase_agent_launch({ launch_mode: "inline_reduced_fidelity", ... })`. This is auditable but does not satisfy strict full-Odin gates.

`odin.prepare_phase_context` can open invocation telemetry for duration/lineage. Invocation telemetry alone is not proof that a canonical phase agent ran.

## Common `odin.*` Tools

These are the runtime calls most users notice first:

| Tool | Purpose |
|------|---------|
| `odin.apply_migrations` | Apply packaged schema migrations |
| `odin.start_feature` | Record a feature in the workflow |
| `odin.get_next_phase` | Ask what should happen next |
| `odin.prepare_phase_context` | Build the next phase bundle for the agent |
| `odin.record_phase_agent_launch` | Record canonical phase-agent launch or reduced-fidelity inline execution |
| `odin.register_phase_execution` | Record actual inline/subagent execution and session linkage |
| `odin.register_phase_realization` | Record proof that a worker used the canonical phase prompt manifest |
| `odin.record_phase_skills_applied` | Audit skills actually applied in a phase |
| `odin.record_phase_artifact` | Save phase outputs, optionally with `artifact_path` metadata |
| `odin.record_phase_result` | Advance or block the phase |
| `odin.complete_phase_bundle` | Record artifacts/evals/claims/checks and phase result in one validated operation |
| `odin.record_release_closeout` | Complete Release after recorded PR merge |
| `odin.record_break_glass_override` | Record a strict-mode exception and create a follow-up gate |
| `odin.run_review_checks` | Run review/security checks; use `tool: "docs_process"` for docs/process-only changes |
| `odin.export_local_artifacts` | Mirror PRD, eval, and release lifecycle records to local markdown |
| `odin.get_feature_status` | Inspect workflow status |

## Optional Features

### Supabase persistence

Switch `.odin/config.yaml` to `runtime.mode: supabase` when you want persistent workflow state.

### TLA+ design verification

Install `tla-precheck` in the target project if you want `odin.verify_design` for state-heavy features:

```bash
npm install -D tla-precheck
```

This also requires Java 17+ locally.

### Dashboard

`@plazmodium/odin` ships the runtime only. The dashboard app lives in the full repo under `dashboard/`.

## Maintainers

If you are developing Odin itself from a repo checkout, use [docs/guides/DEVELOPING-ODIN.md](../docs/guides/DEVELOPING-ODIN.md).

## More Reading

- [docs/guides/GETTING-STARTED.md](../docs/guides/GETTING-STARTED.md)
- [docs/guides/example-workflow.md](../docs/guides/example-workflow.md)
- [docs/guides/SUPABASE-SETUP.md](../docs/guides/SUPABASE-SETUP.md)
- [../loop/README.md](../loop/README.md)
- [../dashboard/README.md](../dashboard/README.md)
