---
name: tailwindcss
description: Utility-first CSS framework for building custom designs without writing CSS
category: frontend
version: "3.x"
compatible_with:
  - nextjs-dev
  - svelte-dev
  - vuejs-dev
  - astro-dev
  - react-patterns
---

# Tailwind CSS

## Overview

Tailwind CSS is a utility-first CSS framework that provides low-level utility classes to build custom designs directly in markup. Instead of writing custom CSS, compose utilities to create any design.

## Project Structure

```
src/
├── styles/
│   └── globals.css          # @tailwind directives + custom utilities
├── tailwind.config.ts       # Theme customization
├── postcss.config.js        # PostCSS with Tailwind plugin
└── components/
    └── Button.tsx           # Components using utility classes
```

## Core Patterns

### Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#3b82f6',
          900: '#1e3a5f',
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

### Base Styles

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-brand-500 text-white rounded-lg
           hover:bg-brand-900 transition-colors
           focus:outline-none focus:ring-2 focus:ring-brand-500;
  }
}
```

### Responsive Design

```html
<!-- Mobile-first: sm → md → lg → xl → 2xl -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <div class="p-4 bg-white rounded-lg shadow">Card</div>
</div>
```

### Dark Mode

```html
<!-- Class-based dark mode (darkMode: 'class' in config) -->
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <p class="text-gray-600 dark:text-gray-400">Content</p>
</div>
```

### Component Patterns

```tsx
// Compose variants with template literals or clsx
import { clsx } from 'clsx';

function Button({ variant = 'primary', size = 'md', children }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-lg font-medium transition-colors focus:outline-none focus:ring-2',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'secondary' && 'bg-gray-200 text-gray-800 hover:bg-gray-300',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-base',
      )}
    >
      {children}
    </button>
  );
}
```

## Best Practices

1. **Use `@apply` sparingly** — only for highly reused component classes
2. **Mobile-first** — start with base styles, add breakpoint prefixes for larger screens
3. **Extract components** — when class lists exceed ~5 utilities, extract to a component
4. **Use design tokens** — extend theme in config rather than using arbitrary values
5. **Purge unused CSS** — ensure `content` paths cover all template files
6. **Group related utilities** — keep layout, spacing, colors, and states grouped logically
7. **Prefer semantic color names** — `brand-500` over `blue-500` in your theme

## Gotchas

- **Arbitrary values** (`w-[137px]`) bypass the design system — use sparingly
- **Specificity issues** with `@apply` inside `@layer` — order matters
- **PurgeCSS false positives** — dynamically constructed class names (`bg-${color}-500`) won't be detected; use safelist or full class names
- **Peer/group modifiers** require correct DOM nesting (`group` on parent, `group-hover:` on child)
