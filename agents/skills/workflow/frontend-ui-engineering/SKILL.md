---
name: frontend-ui-engineering
description: Build user-facing UI with responsive behavior, accessibility, runtime validation, and design-system consistency.
category: workflow
version: "1.0"
---

# frontend-ui-engineering

## When To Use

- Creating or changing visible UI.
- Modifying component structure, state, forms, navigation, or styling.
- Fixing user-facing browser behavior.

## Workflow

1. Inspect existing design system, component patterns, routes, and state conventions.
2. Define desktop, mobile, loading, empty, error, and disabled states.
3. Preserve established visual language unless asked to redesign.
4. Implement semantic markup and keyboard-accessible interactions.
5. Validate responsive behavior at relevant breakpoints.
6. Check console, network, and visible behavior when feasible.
7. Add or update tests for meaningful behavior.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "It compiles, so the UI is done." | UI must work in the browser and across states. |
| "Accessibility can come later." | Accessibility is part of correctness for UI. |
| "The screenshot looks fine." | Static appearance does not prove interactions, errors, or mobile layout. |

## Verification

- UI handles core states and relevant viewport sizes.
- Interactions work with keyboard and pointer where applicable.
- Runtime evidence or tests support the result.

## Exit Criteria

- The UI is usable, accessible, responsive, and consistent with local conventions.
