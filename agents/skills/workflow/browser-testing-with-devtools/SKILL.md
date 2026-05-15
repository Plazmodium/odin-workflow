---
name: browser-testing-with-devtools
description: Verify browser behavior with runtime evidence from DOM, console, network, and performance signals.
category: workflow
version: "1.0"
---

# browser-testing-with-devtools

## When To Use

- Building, debugging, or reviewing browser UI.
- Behavior depends on real DOM, network, storage, layout, or browser APIs.
- Tests pass but runtime behavior is uncertain.

## Workflow

1. Start or locate the app in a browser-capable environment.
2. Reproduce the target user flow.
3. Inspect visible DOM state and accessibility-relevant markup.
4. Check console errors and warnings.
5. Check network requests, status codes, payload shape, and failure behavior.
6. Check performance signals when the task affects rendering, loading, or interaction speed.
7. Capture the evidence needed for the final response.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "Unit tests passed." | Browser integrations fail in ways unit tests do not cover. |
| "The page loaded once." | Check console, network, and key states before trusting it. |
| "Performance seems fine." | Performance claims require measurement. |

## Verification

- Browser flow was exercised or the inability to do so is stated.
- Console and network state were checked when relevant.
- Evidence maps to the acceptance criteria.

## Exit Criteria

- Browser behavior is proven by runtime evidence or explicitly marked unverified.
