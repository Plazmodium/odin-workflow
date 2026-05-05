# Odin MCP Boundary

## Decision

Odin remains available through one local MCP server named `odin`, but Odin should not be described as a generic agent execution runtime.

Odin core is a workflow, state, policy, and context engine. MCP is the interface that lets agent hosts call Odin's workflow tools.

## Boundary

Odin owns:

- workflow state and phase progression
- phase context preparation
- artifact and result recording
- policy checks, gates, and verification records
- persistence integration for workflow data

Odin does not own:

- generic agent execution
- host or child-session orchestration
- sandboxing for arbitrary agent work
- merge authority

Agent execution belongs to the host session, child-agent harness, or Ralph Loop. Ralph Loop may supervise bounded automation, but it records decisions and results back through `odin.*` rather than replacing the MCP server.

## Terminology

Use "MCP server" when referring to the local server exposed to AI coding tools.

Use "runtime package" only in the narrow package sense: the code that runs the MCP-facing Odin server and exposes workflow tools.

Prefer "workflow engine," "workflow layer," or "coordination backend" when describing Odin's architectural role.

## Related Docs

- [Hybrid Orchestration Pattern](./HYBRID-ORCHESTRATION-PATTERN.md)
- [Ralph Loop](../guides/RALPH-LOOP.md)
- [Runtime Package Reference](../../runtime/README.md)
