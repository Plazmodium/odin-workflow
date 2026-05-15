---
name: performance-optimization
description: Improve performance with measurement-first profiling, targeted changes, and regression checks.
category: workflow
version: "1.0"
---

# performance-optimization

## When To Use

- A performance target exists.
- Users report slowness or resource issues.
- A change may affect latency, throughput, memory, bundle size, rendering, or startup.

## Workflow

1. Define the metric and target before optimizing.
2. Measure baseline with the smallest reliable tool.
3. Identify the bottleneck from evidence, not intuition.
4. Make the smallest targeted change.
5. Re-measure the same metric.
6. Check correctness did not regress.
7. Record before/after evidence and residual risk.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "This should be faster." | Performance claims require measurements. |
| "Micro-optimizing this code feels useful." | Optimize the bottleneck, not the visible code. |
| "Caching fixes performance." | Caching adds invalidation and correctness risk. Prove the need. |

## Verification

- Baseline and after measurements use comparable conditions.
- Correctness checks still pass.
- Tradeoffs are explicit.

## Exit Criteria

- The target metric improved or the evidence explains why it did not.
