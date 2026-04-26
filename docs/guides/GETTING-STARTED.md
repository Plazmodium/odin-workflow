# Getting Started With Odin

This guide is for people installing Odin into an existing project.

Odin adds one MCP server named `odin` to your AI coding setup. Your AI tool keeps doing the coding. Odin gives it a spec-first workflow, feature state, migrations, review checks, and reusable learnings.

## Before You Start

You need:

- Node.js 18+
- npm
- a git repository where you want Odin to live
- an AI tool that can connect to a local MCP server

You do not need Supabase to try Odin for the first time.

## Step 1: Run `init` From Your Project Root

Run the command from the directory where you want `.odin/` to be created.

### Auto-configured tools

| Tool | Command |
|------|---------|
| **Codex** | `npx -y @plazmodium/odin init --tool codex --write-mcp` |
| **OpenCode** | `npx -y @plazmodium/odin init --tool opencode --write-mcp` |
| **Claude Code** | `npx -y @plazmodium/odin init --tool claude-code --write-mcp` |
| **Amp** | `npx -y @plazmodium/odin init --tool amp --write-mcp` |

### Generic MCP snippet path

| Tool type | Command |
|-----------|---------|
| **Cursor** | `npx -y @plazmodium/odin init --tool generic` |
| **Junie / other tools** | `npx -y @plazmodium/odin init --tool generic` |

Important:

- If you omit `--project-root`, Odin uses your current directory.
- `--write-mcp` only writes config files for Codex, OpenCode, Claude Code, and Amp.
- `--tool generic` prints the server snippet instead of writing a tool config file.

## Step 2: See What Odin Added

Odin creates files in your project root.

```text
your-project/
├── .env.example
├── .odin/
│   ├── ODIN.md
│   ├── config.yaml
│   ├── agents/
│   │   └── definitions/
│   └── skills/
├── .codex/config.toml    # Codex only when auto-written
├── .mcp.json             # Claude Code / Amp only when auto-written
└── opencode.json         # OpenCode only when auto-written
```

What the main files are for:

- `.odin/config.yaml` - Odin runtime config for this project
- `.odin/ODIN.md` - workflow instructions for the AI agent
- `.odin/agents/definitions/` - the phase-agent prompt definitions the workflow uses
- `.odin/skills/` - project-local skill overrides and additions
- `.env.example` - copy this to `.env` when you want database-backed features

## Step 3: Decide What To Commit

Commit these:

- `.odin/`
- `.env.example`

Keep this local:

- `.env`

For `opencode.json`, `.mcp.json`, or `.codex/config.toml`, follow your team's normal convention for checked-in tool config.

## Step 4: Restart Your AI Tool

After `init`, restart the tool so it reloads MCP servers.

Then ask the AI agent to confirm the `odin` tools are available.

Suggested prompt:

```text
Confirm the `odin` MCP tools are available in this project. Then use `.odin/ODIN.md` as your workflow guide for future feature work and summarize what Odin added to this repo.
```

Important:
`.odin/ODIN.md` is for the AI agent. It is not the human onboarding document.

## Step 5: Choose Whether To Stay In `in_memory`

Odin bootstraps with:

- `runtime.mode: in_memory`

That lets you verify the setup without Supabase or any other external service.

Stay in `in_memory` if you just want to:

- confirm the MCP server loads
- see the workflow shape
- test prompts and phase guidance

Move beyond `in_memory` when you want:

- persistent workflow state
- release archives
- the dashboard

## Step 6: Let The AI Agent Run Migrations When You Are Ready

If you want database-backed tools, do this from your project root:

```bash
cp .env.example .env
```

Then fill in either:

- `DATABASE_URL` for direct PostgreSQL migrations, or
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_ACCESS_TOKEN` for Supabase-backed usage where you also want the AI agent to run `odin.apply_migrations` through the Supabase Management API

Now ask the AI agent to run the packaged migrations:

```text
If Odin database credentials are configured, run `odin.apply_migrations` and tell me what was applied. If the required variables for the path I chose are not configured, tell me exactly which variable names are missing and leave Odin in `in_memory` mode.
```

Most users do not need to run SQL files manually.

## Step 7: Start Your First Feature

Bootstrap happens once per project. Feature work happens many times.

After setup, go back to your AI tool and start the feature there.

The orchestrator is responsible for creating the feature branch first and then recording the feature in Odin. Most users should not need to run a manual `start-feature` CLI command themselves.

Suggested prompt:

```text
Use Odin in this repository. Confirm the `odin` MCP tools are available, use `.odin/ODIN.md` as your workflow guide, and help me start a new feature for: <plain English feature request>. If you need my author name, initials, or any other missing metadata, ask me before starting.
```

If your setup does not automate feature start yet, the manual fallback helper is documented in [../../runtime/README.md](../../runtime/README.md).

## AI Tool Notes

### Codex

- Auto-config is built in with `--tool codex --write-mcp`.
- Odin writes `.codex/config.toml`.

### OpenCode

- Auto-config is built in with `--tool opencode --write-mcp`.
- Odin writes `opencode.json`.

### Claude Code / Amp

- Auto-config is built in with `--tool claude-code --write-mcp` or `--tool amp --write-mcp`.
- Odin writes `.mcp.json`.

### Cursor

- Use `--tool generic` to print the server block.
- Paste that block into Cursor's MCP settings.

### Junie and other tools

- Use `--tool generic` when your tool exposes local MCP server wiring.
- Odin prints the `command`, `args`, and `env` values you need.

## FAQ

### Do I need to clone the Odin repo?

No. Normal users install from the published package.

### Do I need two repos?

No. Odin is meant to live inside the project you already work on.

### Where does `.odin/` get created?

In the project root you pass to `init`, or your current working directory if you omit `--project-root`.

### Do I run `init` again for every feature?

No. `init` is one-time project setup.

### Is `.odin/ODIN.md` for me?

No. It is for the AI agent to follow.

### What if I am in a monorepo?

Point Odin at the directory that should own `.odin/`, `.env`, and the MCP config you want your AI tool to use.

### Where should `ODIN_PROJECT_ROOT` point?

At the project root where `.odin/` lives.

## Related Guides

- [../../README.md](../../README.md)
- [example-workflow.md](example-workflow.md)
- [SUPABASE-SETUP.md](SUPABASE-SETUP.md)
- [DEVELOPING-ODIN.md](DEVELOPING-ODIN.md)
