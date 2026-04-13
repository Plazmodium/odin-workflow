import type { RuntimeToolClient, SubagentExecutor } from './types.js';
import { runTick } from './tick.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runWatchLoop(
  client: RuntimeToolClient,
  supervisor_name: string,
  project_root: string,
  interval_ms: number,
  subagent_executor?: SubagentExecutor,
): Promise<void> {
  while (true) {
    const result = await runTick(client, supervisor_name, project_root, undefined, subagent_executor);
    console.log(`[Ralph Loop] ${result.outcome}: ${result.summary}`);
    await wait(interval_ms);
  }
}
