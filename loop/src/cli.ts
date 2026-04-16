#!/usr/bin/env node

import { loadConfig } from './config.js';
import { connectRuntimeClient } from './runtime-client.js';
import { createCommandSubagentExecutor } from './subagent-command.js';
import { runTick } from './tick.js';
import { runWatchLoop } from './watch.js';

/**
 * Print the CLI usage and available command examples for the Ralph Loop tool to standard output.
 *
 * The message documents how to run the `tick` and `watch` commands and shows examples including
 * the `--project-root`, `--interval-ms`, and `--subagent-command-json` options.
 */
function printHelp(): void {
  console.log(`Ralph Loop

Usage:
  node dist/cli.js tick --project-root /path/to/project
  node dist/cli.js watch --project-root /path/to/project --interval-ms 30000
  node dist/cli.js tick --project-root /path/to/project --subagent-command-json '["node","./child-runner.js"]'
`);
}

/**
 * CLI entrypoint that parses command-line arguments and dispatches the requested command.
 *
 * Loads configuration from the provided argv and environment, connects a runtime client, and optionally
 * creates a subagent executor from configuration. Handles the `tick` command by running a single
 * supervisor tick, logging its outcome and setting `process.exitCode` to `1` on failure or `0` on success.
 * Handles the `watch` command by starting a continuous watch loop (the runtime client is intentionally
 * left open for the duration of the watch). If no command or `--help`/`-h` is provided, prints help and exits.
 *
 * @throws Error if the provided command is not recognized
 */
async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (command == null || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const config = loadConfig(args, process.env);
  const client = await connectRuntimeClient({ project_root: config.project_root });
  const subagent_executor =
    config.subagent_command == null ? undefined : createCommandSubagentExecutor(config.subagent_command);

  try {
    if (command === 'tick') {
      const result = await runTick(client, config.supervisor_name, config.project_root, undefined, subagent_executor);
      console.log(`[Ralph Loop] ${result.outcome}: ${result.summary}`);
      process.exitCode = result.outcome === 'failed' ? 1 : 0;
      return;
    }

    if (command === 'watch') {
      await runWatchLoop(client, config.supervisor_name, config.project_root, config.interval_ms, subagent_executor);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } finally {
    if (command !== 'watch') {
      await client.close();
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown Ralph Loop failure';
  console.error(`[Ralph Loop] ${message}`);
  process.exitCode = 1;
});
