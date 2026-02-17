---
name: react-patterns
description: React component patterns, hooks, state management, and performance optimization
category: frontend
version: "18.x"
compatible_with:
  - nextjs-dev
  - tailwindcss
  - jest
  - vitest
  - typescript
---

# React Patterns

## Overview

React is a declarative component library for building user interfaces. This skill covers idiomatic patterns for components, hooks, state management, and performance.

## Project Structure

```
src/
├── components/
│   ├── ui/                  # Generic UI primitives (Button, Input, Modal)
│   ├── features/            # Feature-specific components
│   └── layouts/             # Page layouts
├── hooks/                   # Custom hooks
├── context/                 # React context providers
├── lib/                     # Utility functions
├── types/                   # Shared TypeScript types
└── App.tsx
```

## Core Patterns

### Component Composition

```tsx
// Prefer composition over prop drilling
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border p-4">{children}</div>;
}

Card.Header = function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-bold">{children}</div>;
};

Card.Body = function CardBody({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
};

// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>
```

### Custom Hooks

```tsx
// Extract reusable logic into hooks
function useAsync<T>(asyncFn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{
    data: T | null;
    error: Error | null;
    loading: boolean;
  }>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));

    asyncFn()
      .then(data => { if (!cancelled) setState({ data, error: null, loading: false }); })
      .catch(error => { if (!cancelled) setState({ data: null, error, loading: false }); });

    return () => { cancelled = true; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
```

### State Management

```tsx
// useReducer for complex state
type State = { items: Item[]; filter: string; sort: SortKey };
type Action =
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'SET_FILTER'; payload: string }
  | { type: 'SET_SORT'; payload: SortKey };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'SET_SORT':
      return { ...state, sort: action.payload };
  }
}
```

### Error Boundaries

```tsx
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

### Performance

```tsx
// Memoize expensive components
const ExpensiveList = React.memo(function ExpensiveList({ items }: { items: Item[] }) {
  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
});

// Memoize expensive calculations
const sorted = useMemo(() => items.sort(compareFn), [items]);

// Stable callback references
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);
```

## Best Practices

1. **Lift state up** only as far as needed — colocate state with the component that uses it
2. **Derive state** from props/existing state instead of syncing with `useEffect`
3. **Key lists properly** — use stable, unique IDs (not array indices)
4. **Avoid premature memoization** — `memo`/`useMemo`/`useCallback` only when profiling shows need
5. **Single responsibility** — one component = one concern
6. **Type events explicitly** — `React.ChangeEvent<HTMLInputElement>` over `any`
7. **Use fragments** — `<>...</>` to avoid unnecessary wrapper divs
8. **Controlled forms** — manage form state in React, not the DOM

## Gotchas

- **Stale closures** in `useEffect`/`useCallback` — check dependency arrays
- **Object/array identity** in deps — `useMemo` to stabilize reference equality
- **useEffect firing twice** in StrictMode (development) — not a bug, tests cleanup
- **setState is async** — use functional updates (`setCount(c => c + 1)`) when depending on previous state
- **Children re-rendering** — pass children as props/composition to avoid unnecessary rerenders
