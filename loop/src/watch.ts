import type { RuntimeToolClient, SubagentExecutor } from './types.js';
import { runTick } from './tick.js';

/**
 * Pause execution for the specified number of milliseconds.
 *
 * @param ms - The delay duration in milliseconds
 * @returns No value; completes after the specified delay
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Continuously runs periodic watch ticks that invoke `runTick`, log each tick's outcome and summary, and wait between iterations.
 *
 * This function runs an infinite loop: each iteration calls `runTick` (forwarding `subagent_executor` when provided), logs the result to the console, and then sleeps for `interval_ms` milliseconds. Uncaught exceptions from `runTick` or the sleep will propagate and terminate the loop.
 *
 * @param supervisor_name - Identifier of the supervisor to monitor
 * @param project_root - Path to the project root used by the tick handler
 * @param interval_ms - Time in milliseconds to wait between iterations
 * @param subagent_executor - Optional subagent executor to forward into `runTick`
 */
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
