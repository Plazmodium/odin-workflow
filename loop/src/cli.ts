#!/usr/bin/env node

import { loadConfig } from './config.js';
import { connectRuntimeClient } from './runtime-client.js';
import { runTick } from './tick.js';
import { runWatchLoop } from './watch.js';

function printHelp(): void {
  console.log(`Ralph Loop

Usage:
  node dist/cli.js tick --project-root /path/to/project
  node dist/cli.js watch --project-root /path/to/project --interval-ms 30000
`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (command == null || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const config = loadConfig(args, process.env);
  const client = await connectRuntimeClient({ project_root: config.project_root });

  try {
    if (command === 'tick') {
      const result = await runTick(client, config.supervisor_name, config.project_root);
      console.log(`[Ralph Loop] ${result.outcome}: ${result.summary}`);
      process.exitCode = result.outcome === 'failed' ? 1 : 0;
      return;
    }

    if (command === 'watch') {
      await runWatchLoop(client, config.supervisor_name, config.project_root, config.interval_ms);
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
