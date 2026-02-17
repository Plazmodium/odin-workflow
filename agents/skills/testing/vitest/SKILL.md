---
name: vitest
description: Vitest testing framework expertise for modern JavaScript/TypeScript testing. Covers Vite-native testing, ESM support, component testing, and fast HMR-based test runs. Use for Vite, Vue, React, or any modern ESM-first project.
category: testing
compatible_with:
  - vuejs-dev
  - svelte-dev
  - react-patterns
  - github-actions
---

# Vitest Testing Framework

## Instructions

1. **Assess the project**: Vitest is ideal for Vite-based projects and ESM-first codebases.
2. **Follow Vitest conventions**:
   - Test files: `*.test.ts`, `*.spec.ts`
   - API is Jest-compatible but with modern ESM imports
   - Leverages Vite's transform pipeline for fast tests
3. **Provide complete examples**: Include proper ESM imports and TypeScript types.
4. **Highlight Vitest features**: In-source testing, browser mode, UI.
5. **Guide on migration**: Help users migrating from Jest.

## Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myFunction } from './myModule';

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return expected value', () => {
    expect(myFunction('input')).toBe('output');
  });

  it('should handle async operations', async () => {
    const result = await myFunction('async');
    expect(result).toBe('done');
  });
});
```

## Mocking with `vi`

### Mock a module
```typescript
vi.mock('./database', () => ({
  query: vi.fn().mockResolvedValue([{ id: 1 }]),
}));
```

### Mock a function
```typescript
const mockFn = vi.fn((x: number) => x + 1);
expect(mockFn(1)).toBe(2);
expect(mockFn).toHaveBeenCalledWith(1);
```

### Spy on methods
```typescript
const spy = vi.spyOn(object, 'method');
object.method();
expect(spy).toHaveBeenCalled();
spy.mockRestore();
```

### Mock timers
```typescript
vi.useFakeTimers();
setTimeout(callback, 1000);
vi.advanceTimersByTime(1000);
expect(callback).toHaveBeenCalled();
vi.useRealTimers();
```

### Mock globals
```typescript
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ data: 'mocked' }),
}));
```

## In-Source Testing

Vitest supports tests directly in source files:

```typescript
// src/utils.ts
export function add(a: number, b: number): number {
  return a + b;
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('add', () => {
    it('adds two numbers', () => {
      expect(add(1, 2)).toBe(3);
    });
  });
}
```

## Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,                    // Use global expect, describe, etc.
    environment: 'jsdom',             // or 'node', 'happy-dom'
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',                 // or 'istanbul'
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/**/*.d.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
    },
  },
});
```

## Snapshot Testing

```typescript
import { expect, it } from 'vitest';

it('matches snapshot', () => {
  const result = generateOutput();
  expect(result).toMatchSnapshot();
});

it('matches inline snapshot', () => {
  expect({ foo: 'bar' }).toMatchInlineSnapshot(`
    {
      "foo": "bar",
    }
  `);
});
```

## Component Testing (Vue/React)

### Vue with @vue/test-utils
```typescript
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent.vue';

describe('MyComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(MyComponent, {
      props: { msg: 'Hello' },
    });
    expect(wrapper.text()).toContain('Hello');
  });
});
```

### React with @testing-library/react
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    await screen.getByRole('button').click();

    expect(onClick).toHaveBeenCalled();
  });
});
```

## Concurrent Tests

```typescript
import { describe, it, expect } from 'vitest';

describe.concurrent('math operations', () => {
  it('adds', async () => {
    expect(1 + 1).toBe(2);
  });

  it('subtracts', async () => {
    expect(2 - 1).toBe(1);
  });
});
```

## Type Testing

```typescript
import { expectTypeOf, describe, it } from 'vitest';

describe('types', () => {
  it('checks return type', () => {
    expectTypeOf(myFunction).returns.toBeString();
  });

  it('checks parameter type', () => {
    expectTypeOf(myFunction).parameter(0).toBeNumber();
  });
});
```

## Best Practices

- **Use `vi` instead of `jest`** - Vitest's mocking API
- **Enable globals** for cleaner test files (no imports needed)
- **Use happy-dom** for faster DOM tests than jsdom
- **Leverage watch mode** - Vitest re-runs on file changes instantly
- **Use workspace mode** for monorepos
- **Type-check tests** - Vitest runs TypeScript natively
- **Use browser mode** for real browser testing when needed

## Migration from Jest

| Jest | Vitest |
|------|--------|
| `jest.fn()` | `vi.fn()` |
| `jest.mock()` | `vi.mock()` |
| `jest.spyOn()` | `vi.spyOn()` |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| `@jest/globals` | `vitest` |

## References

- Vitest Documentation: https://vitest.dev/
- Migration from Jest: https://vitest.dev/guide/migration.html
- Vitest UI: https://vitest.dev/guide/ui.html
