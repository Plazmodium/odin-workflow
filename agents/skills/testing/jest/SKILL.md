---
name: jest
description: Jest testing framework expertise for JavaScript/TypeScript unit and integration testing. Covers test structure, mocking, assertions, snapshots, coverage, and CI integration. Use when writing tests for React, Node.js, or any JS/TS project.
category: testing
compatible_with:
  - react-patterns
  - nodejs-express
  - github-actions
---

# Jest Testing Framework

## Instructions

1. **Assess the testing need**: Determine if it's unit tests, integration tests, or snapshot tests.
2. **Follow Jest conventions**:
   - Test files: `*.test.ts`, `*.spec.ts`, or in `__tests__/` directory
   - Use `describe` blocks to group related tests
   - Use `it` or `test` for individual test cases
   - Use `beforeEach`/`afterEach` for setup/teardown
3. **Provide complete examples**: Include imports, mocks, and assertions.
4. **Guide on mocking**: Explain `jest.mock()`, `jest.fn()`, and `jest.spyOn()`.
5. **Cover edge cases**: Test error conditions, boundary values, and async behavior.

## Test Structure

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { myFunction } from './myModule';

describe('myFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return expected value for valid input', () => {
    const result = myFunction('valid');
    expect(result).toBe('expected');
  });

  it('should throw error for invalid input', () => {
    expect(() => myFunction(null)).toThrow('Invalid input');
  });

  it('should handle async operations', async () => {
    const result = await myFunction('async');
    expect(result).resolves.toBe('done');
  });
});
```

## Mocking Patterns

### Mock a module
```typescript
jest.mock('./database', () => ({
  query: jest.fn().mockResolvedValue([{ id: 1 }]),
}));
```

### Mock a function
```typescript
const mockCallback = jest.fn((x) => x + 1);
expect(mockCallback(1)).toBe(2);
expect(mockCallback).toHaveBeenCalledWith(1);
```

### Spy on methods
```typescript
const spy = jest.spyOn(object, 'method');
object.method();
expect(spy).toHaveBeenCalled();
spy.mockRestore();
```

### Mock timers
```typescript
jest.useFakeTimers();
setTimeout(callback, 1000);
jest.advanceTimersByTime(1000);
expect(callback).toHaveBeenCalled();
```

## Common Assertions

```typescript
// Equality
expect(value).toBe(exact);           // Strict equality
expect(value).toEqual(object);       // Deep equality
expect(value).toStrictEqual(object); // Deep + type equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThanOrEqual(5);
expect(value).toBeCloseTo(0.3, 5);   // Floating point

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(object).toHaveProperty('key', 'value');
expect(object).toMatchObject({ partial: 'match' });

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('message');
expect(() => fn()).toThrow(ErrorClass);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Configuration (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',  // or 'jsdom' for browser
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80 },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

## Best Practices

- **One assertion per test** when possible for clear failure messages
- **Arrange-Act-Assert** pattern for test structure
- **Mock external dependencies** (APIs, databases, file system)
- **Don't test implementation details** - test behavior and outcomes
- **Use meaningful test names** that describe the expected behavior
- **Keep tests fast** - mock slow operations
- **Run tests in CI** with coverage reporting
- **Snapshot tests** for UI components, but review changes carefully

## React Testing (with @testing-library/react)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

test('calls onClick when clicked', () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click me</Button>);

  fireEvent.click(screen.getByRole('button'));

  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

## References

- Jest Documentation: https://jestjs.io/docs/getting-started
- Testing Library: https://testing-library.com/docs/
- Jest Cheat Sheet: https://github.com/sapegin/jest-cheat-sheet
