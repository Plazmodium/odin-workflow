# Example Workflow: First Feature With Odin

This guide shows a current Odin v2 flow from first install to first feature.

The point is not to memorize every phase. The point is to see what a normal first run feels like when Odin is wired into your AI tool.

## Scenario

You have an existing application repo and want to add a login feature.

## 1. Bootstrap Odin In The Project

From your project root, choose the command for your tool.

Examples:

```bash
# Codex
npx -y @plazmodium/odin init --tool codex --write-mcp

# OpenCode
npx -y @plazmodium/odin init --tool opencode --write-mcp

# Claude Code
npx -y @plazmodium/odin init --tool claude-code --write-mcp

# Amp
npx -y @plazmodium/odin init --tool amp --write-mcp

# Cursor / Junie / other generic MCP setups
npx -y @plazmodium/odin init --tool generic
```

Odin creates `.odin/`, `.env.example`, and your MCP config when auto-config is supported.

## 2. Restart The AI Tool And Verify Odin

Restart the tool so it reloads MCP servers.

Then send a prompt like this:

```text
Confirm the `odin` MCP tools are available in this project. Use `.odin/ODIN.md` as your workflow guide, then summarize what Odin added to this repo and whether broad managed workflow assets were synced locally.
```

At this point, Odin is running in `in_memory` mode unless you have already configured database credentials.

## 3. Optional: Configure The Database And Let The Agent Run Migrations

If you want persistent workflow state or packaged migrations, copy the environment template:

```bash
cp .env.example .env
```

Add the credentials you want to use.

Then ask the AI agent to run the migrations:

```text
If Odin database credentials are configured, run `odin.apply_migrations` and summarize the result. If they are not configured yet, tell me what is missing and leave Odin in `in_memory` mode.
```

## 4. Start The Feature

Now stay inside your AI tool and let the agent work through Odin.

Suggested prompt:

```text
Use Odin in this repository. Confirm the `odin` MCP tools are available and help me start a new feature for a login flow. If you need my author name, initials, or any other missing metadata, ask me before starting.
```

In the normal flow, the orchestrator handles branch creation first and then records the feature through `odin.start_feature`.

## 5. What The Agent Usually Does Next

The exact content depends on your feature, but the flow normally looks like this:

1. confirm the feature exists and inspect the next phase
2. use `.odin/ODIN.md` plus phase guidance from `odin.prepare_phase_context`
3. inspect `context.phase_agent_readiness`; in strict mode, launch/realize the canonical phase agent before recording phase work
4. produce the phase output
5. record artifacts/evals/claims individually, or use `odin.complete_phase_bundle` for one validated completion call
6. record `odin.record_phase_skills_applied` for skills actually used
7. close or block the phase with `odin.record_phase_result` when not using the bundle tool
8. move to the next phase

For a normal feature, that means:

1. Product
2. Discovery
3. Architect
4. Guardian
5. Builder
6. Reviewer
7. Integrator
8. Documenter
9. Release

## 6. What You Still Do As The Human

Odin is not trying to remove human judgment.

You still:

- answer product or business questions
- review the generated spec when needed
- approve or reject changes at your normal review boundary
- decide when to add persistence, automation, or dashboard tooling

In the default `guarded` automation mode, the human remains the PR review boundary.

Release handoff can create or prepare a PR, but Odin still treats merge as human-controlled. After merge, record `odin.record_merge`, then `odin.record_release_closeout` to move the feature to Complete.

## 7. Common First-Run Questions

### Do I need to run `init` for every feature?

No. `init` is one-time project bootstrap.

### Do I need to run `odin start-feature` myself?

Usually no. In the normal flow, your AI tool's orchestrating session handles feature start for you. The CLI helper is a manual fallback.

### Do I need to read `.odin/ODIN.md` myself?

No. `odin init` creates it as the local workflow guide for the AI agent.

### Do I need Supabase before I can try Odin?

No. Start in `in_memory` mode and add persistence later.

### Do I have to run SQL manually?

Usually no. Ask the AI agent to run `odin.apply_migrations` once the credentials are configured.

## Related Guides

- [GETTING-STARTED.md](GETTING-STARTED.md)
- [../../runtime/README.md](../../runtime/README.md)
- [SUPABASE-SETUP.md](SUPABASE-SETUP.md)
