---
name: playwright
description: Playwright end-to-end testing expertise for modern web applications. Covers browser automation, cross-browser testing, API testing, visual regression, and CI integration. Use for E2E testing of web apps across Chromium, Firefox, and WebKit.
category: testing
compatible_with:
  - nextjs-dev
  - react-patterns
  - github-actions
---

# Playwright End-to-End Testing

## Instructions

1. **Assess the testing scope**: Determine if it's E2E tests, API tests, or visual regression.
2. **Follow Playwright conventions**:
   - Test files: `*.spec.ts` in `tests/` or `e2e/` directory
   - Use `test` and `expect` from `@playwright/test`
   - Leverage auto-waiting and web-first assertions
3. **Provide complete examples**: Include page objects, fixtures, and proper selectors.
4. **Guide on best practices**: Locators, parallelization, debugging.
5. **Cover advanced features**: Network mocking, authentication, visual comparison.

## Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading')).toHaveText('Welcome');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('[data-testid="email"]', 'invalid@example.com');
    await page.fill('[data-testid="password"]', 'wrong');
    await page.click('[data-testid="submit"]');

    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });
});
```

## Locators (Recommended Order)

```typescript
// 1. Role-based (most resilient)
page.getByRole('button', { name: 'Submit' });
page.getByRole('textbox', { name: 'Email' });
page.getByRole('link', { name: 'Sign up' });

// 2. Label/placeholder text
page.getByLabel('Email address');
page.getByPlaceholder('Enter your email');

// 3. Text content
page.getByText('Welcome back');
page.getByText(/welcome/i);  // Case-insensitive regex

// 4. Test IDs (explicit)
page.getByTestId('submit-button');

// 5. CSS selectors (last resort)
page.locator('.submit-btn');
page.locator('#email-input');
```

## Common Actions

```typescript
// Navigation
await page.goto('https://example.com');
await page.goBack();
await page.reload();

// Clicking
await page.click('button');
await page.dblclick('button');
await page.click('button', { button: 'right' });

// Typing
await page.fill('input', 'text');           // Clear and type
await page.type('input', 'text');           // Type character by character
await page.press('input', 'Enter');         // Press key

// Selection
await page.selectOption('select', 'value');
await page.selectOption('select', { label: 'Option' });

// Checkboxes/Radio
await page.check('input[type="checkbox"]');
await page.uncheck('input[type="checkbox"]');

// File upload
await page.setInputFiles('input[type="file"]', 'path/to/file.pdf');

// Hover
await page.hover('.dropdown-trigger');

// Drag and drop
await page.dragAndDrop('#source', '#target');
```

## Assertions

```typescript
// Visibility
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();

// Text
await expect(locator).toHaveText('exact text');
await expect(locator).toContainText('partial');
await expect(locator).toHaveValue('input value');

// Attributes
await expect(locator).toHaveAttribute('href', '/link');
await expect(locator).toHaveClass(/active/);
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();
await expect(locator).toBeChecked();

// Count
await expect(locator).toHaveCount(3);

// Page
await expect(page).toHaveURL(/dashboard/);
await expect(page).toHaveTitle('Page Title');

// Screenshots
await expect(page).toHaveScreenshot('homepage.png');
await expect(locator).toHaveScreenshot('component.png');
```

## Page Object Model

```typescript
// pages/LoginPage.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

// tests/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test('login flow', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');
  await expect(page).toHaveURL('/dashboard');
});
```

## Fixtures

```typescript
// fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

type Fixtures = {
  loginPage: LoginPage;
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  authenticatedPage: async ({ page }, use) => {
    // Setup: Login
    await page.goto('/login');
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    await use(page);

    // Teardown: Logout
    await page.click('[data-testid="logout"]');
  },
});
```

## API Testing

```typescript
import { test, expect } from '@playwright/test';

test('API: create user', async ({ request }) => {
  const response = await request.post('/api/users', {
    data: {
      email: 'new@example.com',
      name: 'New User',
    },
  });

  expect(response.ok()).toBeTruthy();
  const user = await response.json();
  expect(user.email).toBe('new@example.com');
});

test('API: with authentication', async ({ request }) => {
  const response = await request.get('/api/profile', {
    headers: {
      Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
  });

  expect(response.status()).toBe(200);
});
```

## Network Mocking

```typescript
test('mock API response', async ({ page }) => {
  await page.route('/api/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, name: 'Mocked User' }]),
    });
  });

  await page.goto('/users');
  await expect(page.getByText('Mocked User')).toBeVisible();
});

test('modify response', async ({ page }) => {
  await page.route('/api/data', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.modified = true;
    await route.fulfill({ response, json });
  });
});
```

## Configuration (playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Best Practices

- **Use role-based locators** - Most resilient to UI changes
- **Avoid hard waits** - Use `waitForSelector`, `waitForURL`, auto-waiting
- **Test user flows, not implementation** - Think like a user
- **Use Page Object Model** for large test suites
- **Run in CI** with trace and video on failure
- **Parallelize tests** - Playwright is built for parallel execution
- **Use fixtures** for common setup/teardown
- **Visual regression** for UI-heavy apps

## Debugging

```bash
# Run with UI mode
npx playwright test --ui

# Run with headed browser
npx playwright test --headed

# Debug specific test
npx playwright test --debug tests/login.spec.ts

# Generate code
npx playwright codegen http://localhost:3000
```

## References

- Playwright Documentation: https://playwright.dev/docs/intro
- Best Practices: https://playwright.dev/docs/best-practices
- API Reference: https://playwright.dev/docs/api/class-playwright
