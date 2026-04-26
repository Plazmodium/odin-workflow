<p align="center">
  <img src="assets/Odin.png" alt="Odin Logo" width="128" height="128">
</p>

<h1 align="center">Odin</h1>

<p align="center">
  <strong>Specification-Driven Development for AI-Assisted Coding</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.6.3--beta-orange" alt="Version">
  <img src="https://img.shields.io/badge/workflow-11_phase-blue" alt="11-phase workflow">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

Odin is a workflow layer for AI coding tools. It runs as one MCP server named `odin` and gives your assistant a spec-first feature flow, persistent workflow state, review checks, and reusable learnings.

If you already code with Codex, Claude Code, OpenCode, Amp, Cursor, Junie, or similar tools, Odin is meant to sharpen that workflow instead of replacing it.

## Philosophy

Odin is built on a simple idea: AI coding works best when the work is clear, grounded, and accountable.

- **Spec first**: make the requirement explicit before code starts drifting.
- **Feature first**: move one coherent feature through a workflow instead of scattering work across ad-hoc tasks.
- **Use the tools you already like**: Odin plugs into your existing AI tool instead of trying to replace it.
- **Make decisions visible**: phases, artifacts, checks, and gates should be explicit rather than hidden in prompt history.
- **Keep the human at the right boundary**: AI should accelerate delivery, not erase judgment, review, or responsibility.

## What Odin Changes

- Your AI agent works from a defined feature workflow instead of ad-hoc prompting.
- Specs, tasks, phase outputs, and quality gates become explicit.
- Odin can persist workflow state, learnings, and release history when you are ready for Supabase.
- You keep your current AI tool. Odin plugs into it as an MCP server.

## Who This Is For

- **Using Odin in your own project**: start with the quickstart below.
- **Developing Odin itself**: use [docs/guides/DEVELOPING-ODIN.md](docs/guides/DEVELOPING-ODIN.md).

## How Odin Fits In

```mermaid
flowchart LR
    U[You describe a feature] --> T[Your AI tool<br/>Codex, Claude Code, OpenCode,<br/>Amp, Cursor, Junie, etc.]
    T --> O[Odin MCP server]
    O --> W[Branch-first feature workflow<br/>specs, phases, checks, artifacts]
    W --> R[Your project repo]
    O -. optional later .-> S[(Supabase persistence)]
    R --> H[Human review and PR handoff]
```

## Quick Start

Run the bootstrap command from the root of the project where you want Odin to live.

Important:
Odin writes `.odin/` into the directory you run this command from, unless you pass `--project-root` explicitly.

### Pick your tool

| Tool | Command | What happens |
|------|---------|--------------|
| **Codex** | `npx -y @plazmodium/odin init --tool codex --write-mcp` | Writes `.codex/config.toml` for you |
| **OpenCode** | `npx -y @plazmodium/odin init --tool opencode --write-mcp` | Writes `opencode.json` for you |
| **Claude Code** | `npx -y @plazmodium/odin init --tool claude-code --write-mcp` | Writes `.mcp.json` for you |
| **Amp** | `npx -y @plazmodium/odin init --tool amp --write-mcp` | Writes `.mcp.json` for you |
| **Cursor** | `npx -y @plazmodium/odin init --tool generic` | Prints the MCP server snippet for you to paste into Cursor |
| **Junie / other tools** | `npx -y @plazmodium/odin init --tool generic` | Prints the MCP server snippet if your tool can wire a local MCP server |

What `init` does:

- creates `.odin/config.yaml`
- copies Odin's agent-facing workflow files into `.odin/`
- writes `.env.example`
- writes your MCP config when auto-config is supported for that tool
- defaults Odin to `runtime.mode: in_memory` so you can try it without external services first

### What gets created in your project

- `.odin/config.yaml` - Odin runtime config
- `.odin/ODIN.md` - workflow instructions for your AI agent
- `.odin/agents/definitions/` - the phase-agent prompt definitions Odin uses
- `.odin/skills/` - project-local skill overrides
- `.env.example` - environment variable template
- tool config such as `opencode.json`, `.mcp.json`, or `.codex/config.toml` when auto-config is supported

At minimum, commit `.odin/` and `.env.example`. Keep `.env` local.

## After `init`

1. Restart your AI tool so it reloads MCP servers.
2. Confirm the `odin` MCP server is available.
3. Tell your AI agent to use `.odin/ODIN.md` as its workflow guide.

Suggested first prompt:

```text
Confirm the `odin` MCP tools are available in this project. Then use `.odin/ODIN.md` as your workflow guide for future feature work and tell me what Odin added to this repo.
```

Important:
`.odin/ODIN.md` is for the AI agent. It is not the human onboarding doc.

## Database Setup

You can try Odin immediately in `in_memory` mode without Supabase.

When you are ready for database-backed tools:

1. Copy `.env.example` to `.env`.
2. Add your database credentials.
3. Ask your AI agent to run `odin.apply_migrations` for you.

Suggested prompt:

```text
If Odin database credentials are configured, run `odin.apply_migrations` and summarize what was applied. If they are not configured yet, tell me exactly what is missing and keep Odin in `in_memory` mode for now.
```

Use Supabase when you want persistent workflow state, archival, and the dashboard. Use direct `DATABASE_URL` when you only need `odin.apply_migrations` against PostgreSQL.

## Start Your First Feature

Bootstrap is a one-time project setup step. You do not run it again for every feature.

The normal way to start is back in your AI tool, not with a manual CLI command.

Suggested prompt:

```text
Use Odin in this repository. Confirm the `odin` MCP tools are available, use `.odin/ODIN.md` as your workflow guide, and help me start a new feature for: <plain English feature request>. If you need my author name, initials, or any other missing metadata, ask me before starting.
```

In the normal flow, the orchestrating AI session handles the branch-first + `odin.start_feature` workflow for you.

If your setup does not automate that yet, the manual `odin start-feature` helper is still available in [runtime/README.md](runtime/README.md) as a fallback/operator path.

## Optional Later

- **Supabase persistence**: for persistent runtime state, archival, and the dashboard
- **Ralph Loop**: for optional bounded automation around safe phase pickup and PR handoff
- **Manual MCP wiring**: if you do not want `init --write-mcp` to write your tool config
- **TLA+ design verification**: if you want `odin.verify_design` for state-heavy features

## Documentation

| Document | Use it when |
|----------|-------------|
| [docs/guides/GETTING-STARTED.md](docs/guides/GETTING-STARTED.md) | You want the full first-run guide |
| [runtime/README.md](runtime/README.md) | You want package setup details, config reference, or manual MCP wiring |
| [docs/guides/example-workflow.md](docs/guides/example-workflow.md) | You want a current end-to-end worked example |
| [docs/guides/SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md) | You want the deeper database setup path |
| [loop/README.md](loop/README.md) | You want optional Ralph Loop automation |
| [dashboard/README.md](dashboard/README.md) | You want the optional dashboard app |
| [docs/guides/DEVELOPING-ODIN.md](docs/guides/DEVELOPING-ODIN.md) | You are developing or publishing Odin itself |

## What Odin Includes

- 11-phase feature workflow with explicit phase outputs and checkpoints
- one MCP runtime server named `odin`
- review checks via Semgrep
- learnings capture and propagation
- optional Supabase-backed persistence and archives
- optional dashboard for feature health, claims, learnings, and eval visibility
- optional TLA+ design verification for state-machine-heavy work

## Tool Notes

Odin ships auto-config flows today for:

- Codex
- OpenCode
- Claude Code
- Amp

For Cursor and other tools, `--tool generic` prints the server block you need to wire manually.

For Junie and other emerging agent tools, use the same generic path when your environment exposes local MCP server configuration.

## Status

Odin is in active beta.

What works today:

- 11-phase workflow with sequential phase transitions
- `odin.start_feature`, `odin.prepare_phase_context`, `odin.record_phase_artifact`, `odin.record_phase_result`, and related workflow tools
- `odin.apply_migrations` for packaged schema setup
- Supabase-backed workflow state for persistent runs
- dashboard support for feature, claim, learning, and eval visibility

## License

MIT - see [LICENSE](LICENSE)
