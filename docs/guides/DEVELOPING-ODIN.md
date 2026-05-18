# Developing Odin

This guide is for maintainers and contributors working on the `odin-workflow` repository itself.

If you want to use Odin in an existing project, do not start here. Use [GETTING-STARTED.md](GETTING-STARTED.md).

## Repo Setup

```bash
git clone https://github.com/Plazmodium/odin-workflow.git
cd odin-workflow/runtime
pnpm install
pnpm run build
```

The published package is `@plazmodium/odin`, but maintainers often need the source-checkout flow while changing the runtime itself.

## Bootstrap A Target Project From This Repo Checkout

Run these from `odin-workflow/runtime` after the build completes.

### Claude Code

```bash
pnpm run init:project -- --project-root /path/to/your/project --tool claude-code --distribution source --write-mcp
```

### Amp

```bash
pnpm run init:project -- --project-root /path/to/your/project --tool amp --distribution source --write-mcp
```

### OpenCode

```bash
pnpm run init:project -- --project-root /path/to/your/project --tool opencode --distribution source --write-mcp
```

### Codex

```bash
pnpm run init:project -- --project-root /path/to/your/project --tool codex --distribution source --write-mcp
```

### Cursor / generic tools

```bash
pnpm run init:project -- --project-root /path/to/your/project --tool generic --distribution source
```

That writes the default `.odin/config.yaml`, `.odin/ODIN.md`, `.odin/skills/.gitkeep`, `.env.example`, and MCP wiring into the target project while pointing the MCP server config at this repo checkout's built runtime. Add `--sync-managed-assets` if you also need packaged agent definitions and built-in skills copied for local inspection or override testing.

## Run The Runtime Locally

From `runtime/`:

```bash
pnpm run type-check
pnpm test
pnpm start
```

Useful commands:

- `pnpm run build` - compile TypeScript to `dist/`
- `pnpm run dev` - watch mode
- `pnpm run init:project` - source-checkout bootstrap helper

## Ralph Loop

From the repo root:

```bash
pnpm run ralph:tick -- --project-root /path/to/your/project
pnpm run ralph:watch -- --project-root /path/to/your/project --interval-ms 30000
```

Use [../../loop/README.md](../../loop/README.md) and [RALPH-LOOP.md](RALPH-LOOP.md) for the operator details.

## Publishing

Use [NPM-PUBLISH.md](NPM-PUBLISH.md) for the publish checklist and release flow.

## Maintainer Notes

- Keep `runtime/README.md` accurate for the published package path.
- Keep the root `README.md` user-first.
- Treat repo `ODIN.md` as framework source material, not the main human onboarding guide.
