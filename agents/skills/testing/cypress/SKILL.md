---
name: cypress
description: Cypress end-to-end testing expertise for web applications. Covers browser testing, component testing, network stubbing, and CI integration. Use for E2E and component testing with real-time browser preview and time-travel debugging.
category: testing
compatible_with:
  - nextjs-dev
  - react-patterns
  - vuejs-dev
  - github-actions
---

# Cypress End-to-End Testing

## Instructions

1. **Assess the testing scope**: Determine if it's E2E tests, component tests, or API tests.
2. **Follow Cypress conventions**:
   - E2E tests: `cypress/e2e/*.cy.ts`
   - Component tests: `*.cy.tsx` alongside components
   - Use `cy` commands for all interactions
3. **Provide complete examples**: Include selectors, assertions, and custom commands.
4. **Guide on best practices**: Selectors, waiting, anti-patterns.
5. **Cover advanced features**: Intercepts, fixtures, custom commands.

## Test Structure

```typescript
describe('User Authentication', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should login with valid credentials', () => {
    cy.get('[data-testid="email"]').type('user@example.com');
    cy.get('[data-testid="password"]').type('password123');
    cy.get('[data-testid="submit"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('h1').should('contain', 'Welcome');
  });

  it('should show error for invalid credentials', () => {
    cy.get('[data-testid="email"]').type('invalid@example.com');
    cy.get('[data-testid="password"]').type('wrong');
    cy.get('[data-testid="submit"]').click();

    cy.contains('Invalid credentials').should('be.visible');
  });
});
```

## Selectors (Recommended Order)

```typescript
// 1. Data attributes (most resilient)
cy.get('[data-testid="submit-button"]');
cy.get('[data-cy="email-input"]');

// 2. Contains text
cy.contains('Submit');
cy.contains('button', 'Submit');  // Element + text

// 3. Role-based (with cypress-testing-library)
cy.findByRole('button', { name: 'Submit' });
cy.findByLabelText('Email');
cy.findByPlaceholderText('Enter email');

// 4. CSS selectors
cy.get('.submit-btn');
cy.get('#email-input');
cy.get('form input[type="email"]');
```

## Common Commands

```typescript
// Navigation
cy.visit('/page');
cy.go('back');
cy.reload();

// Clicking
cy.get('button').click();
cy.get('button').dblclick();
cy.get('button').rightclick();
cy.get('button').click({ force: true });  // Skip visibility checks

// Typing
cy.get('input').type('Hello');
cy.get('input').type('{enter}');          // Special keys
cy.get('input').type('text{enter}');      // Text + enter
cy.get('input').clear().type('new text');

// Selection
cy.get('select').select('value');
cy.get('select').select(['opt1', 'opt2']); // Multiple

// Checkboxes/Radio
cy.get('input[type="checkbox"]').check();
cy.get('input[type="checkbox"]').uncheck();
cy.get('input[type="radio"]').check('value');

// Focus/Blur
cy.get('input').focus();
cy.get('input').blur();

// Scrolling
cy.scrollTo('bottom');
cy.get('.list').scrollTo(0, 500);

// File upload
cy.get('input[type="file"]').selectFile('path/to/file.pdf');
```

## Assertions

```typescript
// Visibility
cy.get('button').should('be.visible');
cy.get('modal').should('not.exist');
cy.get('loader').should('not.be.visible');

// Text
cy.get('h1').should('have.text', 'Exact Text');
cy.get('h1').should('contain', 'Partial');
cy.get('input').should('have.value', 'input value');

// Attributes
cy.get('a').should('have.attr', 'href', '/link');
cy.get('button').should('have.class', 'active');
cy.get('button').should('be.enabled');
cy.get('button').should('be.disabled');
cy.get('input').should('be.checked');

// Count
cy.get('li').should('have.length', 3);
cy.get('li').should('have.length.greaterThan', 2);

// URL
cy.url().should('include', '/dashboard');
cy.url().should('eq', 'http://localhost:3000/dashboard');

// Chaining
cy.get('input')
  .should('be.visible')
  .and('have.attr', 'placeholder', 'Email')
  .and('be.enabled');
```

## Network Interception

```typescript
// Stub a response
cy.intercept('GET', '/api/users', {
  statusCode: 200,
  body: [{ id: 1, name: 'John' }],
}).as('getUsers');

cy.visit('/users');
cy.wait('@getUsers');
cy.contains('John').should('be.visible');

// Wait for real request
cy.intercept('POST', '/api/login').as('login');
cy.get('form').submit();
cy.wait('@login').its('response.statusCode').should('eq', 200);

// Modify response
cy.intercept('GET', '/api/data', (req) => {
  req.reply((res) => {
    res.body.modified = true;
    return res;
  });
});

// Delay response
cy.intercept('GET', '/api/slow', (req) => {
  req.on('response', (res) => {
    res.setDelay(2000);
  });
});

// Simulate error
cy.intercept('GET', '/api/data', {
  statusCode: 500,
  body: { error: 'Server error' },
});
```

## Fixtures

```typescript
// cypress/fixtures/users.json
[
  { "id": 1, "name": "John", "email": "john@example.com" },
  { "id": 2, "name": "Jane", "email": "jane@example.com" }
]

// In tests
cy.fixture('users').then((users) => {
  cy.intercept('GET', '/api/users', users);
});

// Or directly
cy.intercept('GET', '/api/users', { fixture: 'users.json' });
```

## Custom Commands

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type(email);
    cy.get('[data-testid="password"]').type(password);
    cy.get('[data-testid="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});

Cypress.Commands.add('getBySel', (selector: string) => {
  return cy.get(`[data-testid="${selector}"]`);
});

// Usage
cy.login('user@example.com', 'password');
cy.getBySel('submit-button').click();

// TypeScript declarations (cypress/support/index.d.ts)
declare namespace Cypress {
  interface Chainable {
    login(email: string, password: string): Chainable<void>;
    getBySel(selector: string): Chainable<JQuery<HTMLElement>>;
  }
}
```

## Component Testing

```typescript
// Button.cy.tsx
import Button from './Button';

describe('Button', () => {
  it('renders with text', () => {
    cy.mount(<Button>Click me</Button>);
    cy.contains('Click me').should('be.visible');
  });

  it('calls onClick when clicked', () => {
    const onClick = cy.stub().as('onClick');
    cy.mount(<Button onClick={onClick}>Click</Button>);

    cy.get('button').click();
    cy.get('@onClick').should('have.been.calledOnce');
  });

  it('can be disabled', () => {
    cy.mount(<Button disabled>Disabled</Button>);
    cy.get('button').should('be.disabled');
  });
});
```

## Configuration (cypress.config.ts)

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      // Plugins
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
  },
  env: {
    apiUrl: 'http://localhost:3001',
  },
});
```

## Best Practices

- **Use data-testid** or data-cy attributes for selectors
- **Don't use cy.wait(ms)** - Use intercepts and assertions
- **Keep tests independent** - Each test should work in isolation
- **Use cy.session()** for login/auth to speed up tests
- **Avoid conditional testing** - Tests should be deterministic
- **Use aliases** for readability (`cy.get(...).as('button')`)
- **Chain assertions** instead of multiple `cy.get()` calls
- **Test user flows** not implementation details

## Anti-Patterns to Avoid

```typescript
// ❌ Don't use arbitrary waits
cy.wait(5000);

// ✅ Wait for specific conditions
cy.get('button').should('be.visible');
cy.intercept('/api/*').as('api');
cy.wait('@api');

// ❌ Don't rely on DOM structure
cy.get('div > div > ul > li:first-child');

// ✅ Use data attributes
cy.get('[data-testid="first-item"]');

// ❌ Don't share state between tests
let userId;
it('creates user', () => { userId = createUser(); });
it('uses user', () => { /* uses userId */ });

// ✅ Each test is independent
it('user flow', () => {
  const user = createUser();
  // use user in same test
});
```

## Debugging

```bash
# Open Cypress UI
npx cypress open

# Run headless
npx cypress run

# Run specific spec
npx cypress run --spec "cypress/e2e/login.cy.ts"

# With browser
npx cypress run --browser chrome
```

```typescript
// In tests - pause and inspect
cy.pause();

// Debug in console
cy.get('button').then(($btn) => {
  debugger;
  console.log($btn.text());
});
```

## References

- Cypress Documentation: https://docs.cypress.io/
- Best Practices: https://docs.cypress.io/guides/references/best-practices
- API Reference: https://docs.cypress.io/api/table-of-contents
